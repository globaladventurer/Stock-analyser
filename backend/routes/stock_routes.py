from flask import Blueprint, jsonify, request
import logging
import math
import numpy as np
import requests
import urllib.parse
import yfinance as yf
from datetime import datetime, timedelta
from .sentiment_analysis import fetch_and_analyze_stock_sentiment, analyze_sentiment, classify_sentiment
from .risk_analysis import fetch_risk_results, risk_analysis_model
from .prediction_analysis import stock_price_predictor, train_or_load_model

def sanitize(obj):
    """Recursively replace NaN/Inf floats with None so JSON stays valid."""
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize(v) for v in obj]
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    # numpy scalar types
    try:
        import numpy as np
        if isinstance(obj, (np.floating,)):
            v = float(obj)
            return None if (math.isnan(v) or math.isinf(v)) else v
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, np.bool_):
            return bool(obj)
    except Exception:
        pass
    return obj

stock_bp = Blueprint('stock', __name__)
risk_bp = Blueprint('risk', __name__)

portfolio = [
    'TCS.NS', 'ITC.NS', 'ETERNAL.NS', 'TATASTEEL.NS', 'INFY.NS', 
    'RELIANCE.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS'
]

# Alias map for delisted / renamed / merged stocks
TICKER_ALIASES = {
    'ZOMATO': 'ETERNAL.NS',
    'ZOMATO.NS': 'ETERNAL.NS',
    'TATAMOTORS': 'TMPV.NS',
    'TATAMOTORS.NS': 'TMPV.NS',
    'HDFC': 'HDFCBANK.NS',
    'HDFC.NS': 'HDFCBANK.NS',
}

# Curated list of prominent Indian companies for instant zero-latency match
POPULAR_INDIAN_STOCKS = [
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries Limited", "exchange": "NSE", "keywords": ["reliance", "ril", "mukesh ambani"]},
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services Limited", "exchange": "NSE", "keywords": ["tcs", "tata consultancy"]},
    {"symbol": "HDFCBANK.NS", "name": "HDFC Bank Limited", "exchange": "NSE", "keywords": ["hdfc", "hdfcbank", "hdfc bank"]},
    {"symbol": "INFY.NS", "name": "Infosys Limited", "exchange": "NSE", "keywords": ["infy", "infosys"]},
    {"symbol": "ICICIBANK.NS", "name": "ICICI Bank Limited", "exchange": "NSE", "keywords": ["icici", "icicibank", "icici bank"]},
    {"symbol": "SBIN.NS", "name": "State Bank of India", "exchange": "NSE", "keywords": ["sbi", "sbin", "state bank"]},
    {"symbol": "BHARTIARTL.NS", "name": "Bharti Airtel Limited", "exchange": "NSE", "keywords": ["airtel", "bharti", "bhartiartl"]},
    {"symbol": "ITC.NS", "name": "ITC Limited", "exchange": "NSE", "keywords": ["itc"]},
    {"symbol": "TMPV.NS", "name": "Tata Motors Passenger Vehicles Limited", "exchange": "NSE", "keywords": ["tata motors", "tatamotors", "tmpv", "tmcv"]},
    {"symbol": "TATASTEEL.NS", "name": "Tata Steel Limited", "exchange": "NSE", "keywords": ["tata steel", "tatasteel"]},
    {"symbol": "LT.NS", "name": "Larsen & Toubro Limited", "exchange": "NSE", "keywords": ["lt", "l&t", "larsen"]},
    {"symbol": "MARUTI.NS", "name": "Maruti Suzuki India Limited", "exchange": "NSE", "keywords": ["maruti", "suzuki"]},
    {"symbol": "HINDUNILVR.NS", "name": "Hindustan Unilever Limited", "exchange": "NSE", "keywords": ["hul", "hindunilvr", "unilever", "hindustan unilever"]},
    {"symbol": "BAJFINANCE.NS", "name": "Bajaj Finance Limited", "exchange": "NSE", "keywords": ["bajfinance", "bajaj finance"]},
    {"symbol": "KOTAKBANK.NS", "name": "Kotak Mahindra Bank Limited", "exchange": "NSE", "keywords": ["kotak", "kotakbank", "kotak mahindra"]},
    {"symbol": "WIPRO.NS", "name": "Wipro Limited", "exchange": "NSE", "keywords": ["wipro"]},
    {"symbol": "ETERNAL.NS", "name": "Eternal Limited (formerly Zomato)", "exchange": "NSE", "keywords": ["zomato", "eternal"]},
    {"symbol": "TITAN.NS", "name": "Titan Company Limited", "exchange": "NSE", "keywords": ["titan", "tanishq"]},
    {"symbol": "SUNPHARMA.NS", "name": "Sun Pharmaceutical Industries", "exchange": "NSE", "keywords": ["sunpharma", "sun pharma"]},
    {"symbol": "ADANIENT.NS", "name": "Adani Enterprises Limited", "exchange": "NSE", "keywords": ["adani", "adanient", "adani enterprises"]},
    {"symbol": "ADANIPORTS.NS", "name": "Adani Ports and SEZ", "exchange": "NSE", "keywords": ["adani ports", "adaniports"]},
    {"symbol": "AXISBANK.NS", "name": "Axis Bank Limited", "exchange": "NSE", "keywords": ["axis", "axisbank", "axis bank"]},
    {"symbol": "ASIANPAINT.NS", "name": "Asian Paints Limited", "exchange": "NSE", "keywords": ["asian paints", "asianpaint"]},
    {"symbol": "HCLTECH.NS", "name": "HCL Technologies Limited", "exchange": "NSE", "keywords": ["hcl", "hcltech"]},
    {"symbol": "POWERGRID.NS", "name": "Power Grid Corporation of India", "exchange": "NSE", "keywords": ["powergrid", "power grid"]},
    {"symbol": "NTPC.NS", "name": "NTPC Limited", "exchange": "NSE", "keywords": ["ntpc"]},
    {"symbol": "ONGC.NS", "name": "Oil and Natural Gas Corporation", "exchange": "NSE", "keywords": ["ongc"]},
    {"symbol": "COALINDIA.NS", "name": "Coal India Limited", "exchange": "NSE", "keywords": ["coal india", "coalindia"]},
    {"symbol": "BAJAJ-AUTO.NS", "name": "Bajaj Auto Limited", "exchange": "NSE", "keywords": ["bajaj auto", "bajaj-auto"]},
    {"symbol": "TECHM.NS", "name": "Tech Mahindra Limited", "exchange": "NSE", "keywords": ["techm", "tech mahindra"]},
    {"symbol": "NESTLEIND.NS", "name": "Nestle India Limited", "exchange": "NSE", "keywords": ["nestle", "nestleind"]},
    {"symbol": "JSWSTEEL.NS", "name": "JSW Steel Limited", "exchange": "NSE", "keywords": ["jsw", "jswsteel", "jsw steel"]},
    {"symbol": "ULTRACEMCO.NS", "name": "UltraTech Cement Limited", "exchange": "NSE", "keywords": ["ultratech", "ultracemco"]},
    {"symbol": "BAJAJFINSV.NS", "name": "Bajaj Finserv Limited", "exchange": "NSE", "keywords": ["bajaj finserv", "bajajfinsv"]},
    {"symbol": "GRASIM.NS", "name": "Grasim Industries Limited", "exchange": "NSE", "keywords": ["grasim"]},
    {"symbol": "DRREDDY.NS", "name": "Dr. Reddy's Laboratories Limited", "exchange": "NSE", "keywords": ["dr reddy", "drreddy"]},
    {"symbol": "CIPLA.NS", "name": "Cipla Limited", "exchange": "NSE", "keywords": ["cipla"]},
    {"symbol": "EICHERMOT.NS", "name": "Eicher Motors Limited", "exchange": "NSE", "keywords": ["eicher", "royal enfield", "eichermot"]},
    {"symbol": "M&M.NS", "name": "Mahindra & Mahindra Limited", "exchange": "NSE", "keywords": ["mahindra", "m&m"]},
    {"symbol": "DIVISLAB.NS", "name": "Divi's Laboratories Limited", "exchange": "NSE", "keywords": ["divis", "divislab"]},
    {"symbol": "APOLLOHOSP.NS", "name": "Apollo Hospitals Enterprise Limited", "exchange": "NSE", "keywords": ["apollo", "apollohosp"]},
    {"symbol": "TATACONSUM.NS", "name": "Tata Consumer Products Limited", "exchange": "NSE", "keywords": ["tata consumer", "tataconsum", "tata tea"]},
    {"symbol": "HEROMOTOCO.NS", "name": "Hero MotoCorp Limited", "exchange": "NSE", "keywords": ["hero", "heromotoco"]},
    {"symbol": "HINDALCO.NS", "name": "Hindalco Industries Limited", "exchange": "NSE", "keywords": ["hindalco"]},
    {"symbol": "INDUSINDBK.NS", "name": "IndusInd Bank Limited", "exchange": "NSE", "keywords": ["indusind", "indusindbk"]},
    {"symbol": "HAL.NS", "name": "Hindustan Aeronautics Limited", "exchange": "NSE", "keywords": ["hal", "hindustan aeronautics"]},
    {"symbol": "BEL.NS", "name": "Bharat Electronics Limited", "exchange": "NSE", "keywords": ["bel", "bharat electronics"]},
    {"symbol": "BHEL.NS", "name": "Bharat Heavy Electricals Limited", "exchange": "NSE", "keywords": ["bhel"]},
    {"symbol": "VEDL.NS", "name": "Vedanta Limited", "exchange": "NSE", "keywords": ["vedl", "vedanta"]},
    {"symbol": "IRFC.NS", "name": "Indian Railway Finance Corporation", "exchange": "NSE", "keywords": ["irfc"]},
    {"symbol": "IRCTC.NS", "name": "Indian Railway Catering and Tourism Corp", "exchange": "NSE", "keywords": ["irctc"]},
    {"symbol": "JIOFIN.NS", "name": "Jio Financial Services Limited", "exchange": "NSE", "keywords": ["jio", "jiofin", "jio financial"]},
    {"symbol": "TRENT.NS", "name": "Trent Limited", "exchange": "NSE", "keywords": ["trent", "westside", "zudio"]},
    {"symbol": "PAYTM.NS", "name": "One97 Communications Limited (Paytm)", "exchange": "NSE", "keywords": ["paytm"]},
    {"symbol": "BSE.NS", "name": "BSE Limited", "exchange": "NSE", "keywords": ["bse"]},
    {"symbol": "CDSL.NS", "name": "Central Depository Services (India) Limited", "exchange": "NSE", "keywords": ["cdsl"]},
    {"symbol": "^NSEI", "name": "NIFTY 50", "exchange": "NSE", "keywords": ["nifty", "nifty 50"]},
    {"symbol": "^BSESN", "name": "S&P BSE SENSEX", "exchange": "BSE", "keywords": ["sensex", "bse sensex"]},
]

@risk_bp.route('/analyze/<symbol>', methods=['GET'])
def analyze_stock_risk(symbol):
    try:
        if not symbol:
            return jsonify({"error": "Symbol is required"}), 400
        
        # Check alias
        symbol = TICKER_ALIASES.get(symbol.upper(), symbol)
        results = fetch_risk_results(symbol, portfolio)
        
        if 'error' in results:
            return jsonify({
                "risk_analysis": {
                    "error": results['error'],
                    "risk_level": 'Medium',
                    "volatility": 'N/A',
                    "daily_return": 'N/A',
                    "current_price": 'N/A',
                    "trend": 'N/A',
                    "latest_close": None
                }
            }), 200
        
        return jsonify({"risk_analysis": results})
    except Exception as e:
        logging.error(f"Error analyzing risk for {symbol}: {str(e)}")
        return jsonify({
            "risk_analysis": {
                "error": "Failed to analyze stock risk",
                "risk_level": 'Medium',
                "volatility": 'N/A',
                "daily_return": 'N/A',
                "current_price": 'N/A',
                "trend": 'N/A',
                "latest_close": None
            }
        }), 200

def search_stocks(query):
    query = query.strip()
    q_lower = query.lower()
    results = []
    seen = set()

    # 1. Match local curated popular stocks
    for stock in POPULAR_INDIAN_STOCKS:
        sym = stock['symbol']
        name_lower = stock['name'].lower()
        sym_lower = sym.lower()
        if (q_lower in sym_lower or 
            q_lower in name_lower or 
            any(q_lower in kw for kw in stock['keywords'])):
            if sym not in seen:
                seen.add(sym)
                results.append({
                    'symbol': sym,
                    'name': stock['name'],
                    'exchange': stock['exchange'],
                    'type': 'INDEX' if sym.startswith('^') else 'EQUITY'
                })

    # 2. Query Yahoo Finance search API (worldwide coverage)
    try:
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={urllib.parse.quote(query)}&quotesCount=12&newsCount=0"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code == 200:
            for item in resp.json().get('quotes', []):
                sym = item.get('symbol')
                if sym and sym not in seen:
                    seen.add(sym)
                    results.append({
                        'symbol': sym,
                        'name': item.get('longname') or item.get('shortname') or sym,
                        'exchange': item.get('exchDisp') or item.get('exchange', ''),
                        'type': item.get('quoteType', 'EQUITY')
                    })
    except Exception as e:
        logging.error(f"Yahoo Finance search error: {e}")

    # 3. If no results found yet, and query has no dot, test query + '.NS'
    if not results and '.' not in query and len(query) <= 12 and ' ' not in query:
        ns_sym = f"{query.upper()}.NS"
        if ns_sym not in seen:
            try:
                t = yf.Ticker(ns_sym)
                hist = t.history(period='1d')
                if not hist.empty:
                    name = t.info.get('longName') or t.info.get('shortName') or ns_sym
                    results.append({
                        'symbol': ns_sym,
                        'name': name,
                        'exchange': 'NSE',
                        'type': 'EQUITY'
                    })
                    seen.add(ns_sym)
            except Exception:
                pass

    return results

@stock_bp.route('/search', methods=['GET'])
def search_stocks_route():
    query = request.args.get('name', '').strip()
    if not query:
        return jsonify({"error": "Please provide a valid stock name or symbol"}), 400

    try:
        search_results = search_stocks(query)
        return jsonify(search_results)
    except Exception as e:
        logging.error(f"Error in stock search route: {e}")
        return jsonify({"error": "An error occurred while searching stocks"}), 500

def get_stock_details(symbol):
    try:
        symbol = symbol.strip()
        # Resolve aliases
        symbol = TICKER_ALIASES.get(symbol.upper(), symbol)

        stock = yf.Ticker(symbol)
        hist_5d = stock.history(period='5d')

        # If empty and symbol has no suffix, try with .NS
        if hist_5d.empty and '.' not in symbol:
            ns_symbol = f"{symbol.upper()}.NS"
            test_stock = yf.Ticker(ns_symbol)
            test_hist = test_stock.history(period='5d')
            if not test_hist.empty:
                symbol = ns_symbol
                stock = test_stock
                hist_5d = test_hist

        if hist_5d.empty:
            logging.warning(f"No price history found for symbol: {symbol}")

        # Structure default response
        stock_details = {
            'current_quote': {
                'price': 0.0,
                'change': 0.0,
                'change_percent': 0.0,
            },
            'profile': {
                'name': symbol,
                'symbol': symbol,
                'industry': 'Unknown',
                'sector': 'Unknown',
                'country': 'India' if (symbol.endswith('.NS') or symbol.endswith('.BO')) else 'Unknown',
                'website': '#',
                'currency': 'INR' if (symbol.endswith('.NS') or symbol.endswith('.BO')) else 'USD'
            },
            'historical_prices': [],
            'news': [],
            'sentiment': None,
            'risk_analysis': None,
            'price_prediction': None
        }

        # Company profile
        info = {}
        try:
            info = stock.info or {}
            stock_details['profile'].update({
                'name': info.get('longName') or info.get('shortName') or symbol,
                'industry': info.get('industry', 'Unknown'),
                'sector': info.get('sector', 'Unknown'),
                'country': info.get('country') or ('India' if (symbol.endswith('.NS') or symbol.endswith('.BO')) else 'Unknown'),
                'website': info.get('website', '#'),
                'currency': info.get('currency') or ('INR' if (symbol.endswith('.NS') or symbol.endswith('.BO')) else 'USD')
            })
        except Exception as e:
            logging.warning(f"Error getting stock info for {symbol}: {e}")

        # Current Quote Calculation — safely handle NaN from yfinance
        if not hist_5d.empty:
            try:
                close_price = float(hist_5d['Close'].iloc[-1])
                if math.isnan(close_price) or math.isinf(close_price):
                    close_price = 0.0

                if len(hist_5d) > 1:
                    prev_close = float(hist_5d['Close'].iloc[-2])
                    if math.isnan(prev_close) or math.isinf(prev_close):
                        prev_close = close_price
                else:
                    prev_raw = info.get('previousClose', close_price)
                    try:
                        prev_close = float(prev_raw)
                        if math.isnan(prev_close) or math.isinf(prev_close):
                            prev_close = close_price
                    except (TypeError, ValueError):
                        prev_close = close_price

                change = close_price - prev_close
                change_percent = (change / prev_close) * 100 if prev_close else 0.0

                stock_details['current_quote'] = {
                    'price': round(close_price, 2),
                    'change': round(change, 2),
                    'change_percent': round(change_percent, 2)
                }
            except Exception as e:
                logging.warning(f"Error computing quote for {symbol}: {e}")

        # Historical Prices (Last 1 year)
        try:
            historical_data = stock.history(period='1y')
            if not historical_data.empty:
                stock_details['historical_prices'] = [
                    {
                        'date': idx.strftime('%Y-%m-%d'),
                        'close': round(float(row['Close']), 2)
                    }
                    for idx, row in historical_data.iterrows()
                ]
        except Exception as e:
            logging.warning(f"Error getting historical prices for {symbol}: {e}")

        # Fetch News and Sentiment using live Yahoo Finance news + VADER sentiment
        news_items = []
        try:
            raw_news = stock.news
            if raw_news and isinstance(raw_news, list):
                for item in raw_news[:8]:
                    content = item.get('content', {}) if isinstance(item.get('content'), dict) else {}
                    title = content.get('title') or item.get('title') or ''
                    summary = content.get('summary') or item.get('summary') or ''
                    link = content.get('canonicalUrl', {}).get('url') or item.get('link') or '#'
                    pub = content.get('provider', {}).get('displayName') or item.get('publisher') or 'Financial News'
                    pub_date = content.get('pubDate') or str(item.get('providerPublishTime', ''))

                    if title:
                        text_to_score = f"{title}. {summary}"
                        sentiment_score = analyze_sentiment(text_to_score)
                        news_items.append({
                            'title': title,
                            'headline': title,
                            'publisher': pub,
                            'link': link,
                            'url': link,
                            'description': summary if summary else title,
                            'published_at': pub_date,
                            'relevant_prediction': sentiment_score,
                            'sentiment_classification': classify_sentiment(sentiment_score)
                        })
        except Exception as e:
            logging.error(f"Error parsing news for {symbol}: {e}")

        # If yfinance news was empty, try sentiment analysis fallback
        if not news_items:
            try:
                sentiment_data = fetch_and_analyze_stock_sentiment(symbol)
                news_items = sentiment_data.get('news', [])
                if sentiment_data.get('overall_prediction') is not None:
                    stock_details['sentiment'] = {
                        'overall_prediction': sentiment_data.get('overall_prediction')
                    }
            except Exception:
                pass

        if news_items:
            stock_details['news'] = news_items
            if not stock_details['sentiment']:
                scores = [it['relevant_prediction'] for it in news_items if 'relevant_prediction' in it]
                if scores:
                    avg_score = sum(scores) / len(scores)
                    stock_details['sentiment'] = {
                        'overall_prediction': round(avg_score, 1)
                    }

        if not stock_details['sentiment']:
            stock_details['sentiment'] = {'overall_prediction': 52.0}

        # Direct in-process Risk Analysis (No self-HTTP deadlock!)
        try:
            risk_result = fetch_risk_results(symbol, portfolio)
            if risk_result and 'error' not in risk_result:
                stock_details['risk_analysis'] = risk_result
            else:
                stock_details['risk_analysis'] = {
                    'risk_level': 'Medium',
                    'volatility': 'N/A',
                    'daily_return': 'N/A',
                    'current_price': str(stock_details['current_quote']['price']),
                    'latest_close': stock_details['current_quote']['price'],
                    'trend': 'Bullish' if stock_details['current_quote']['change'] >= 0 else 'Bearish'
                }
        except Exception as e:
            logging.error(f"Error fetching risk analysis: {e}")
            stock_details['risk_analysis'] = {
                'risk_level': 'Medium',
                'volatility': 'N/A',
                'daily_return': 'N/A',
                'current_price': str(stock_details['current_quote']['price']),
                'latest_close': stock_details['current_quote']['price'],
                'trend': 'Neutral'
            }

        # Price Prediction
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=365)
            prediction_result = stock_price_predictor(symbol, start_date, end_date)
            if prediction_result and 'error' not in prediction_result:
                stock_details['price_prediction'] = {
                    'predicted_price': prediction_result.get('predicted_price'),
                    'last_close_price': prediction_result.get('last_close_price'),
                    'price_change': prediction_result.get('price_change'),
                    'price_change_percent': prediction_result.get('price_change_percent', 0.0),
                    'prediction_confidence': prediction_result.get('prediction_confidence', 85.0),
                    'prediction_direction': prediction_result.get('prediction_direction', 'Bullish')
                }
        except Exception as e:
            logging.warning(f"Error in price prediction: {e}")

        return stock_details

    except Exception as e:
        logging.error(f"Comprehensive error fetching stock details: {e}")
        return None

@stock_bp.route('/details/<symbol>', methods=['GET'])
def stock_details_route(symbol):
    if not symbol:
        return jsonify({"error": "Symbol is required"}), 400

    try:
        details = get_stock_details(symbol)
        if details is None:
            return jsonify({"error": f"Could not retrieve stock details for {symbol}"}), 404
        return jsonify(sanitize(details))
    except Exception as e:
        logging.error(f"Error in stock details route: {e}")
        return jsonify({"error": "An unexpected error occurred"}), 500
