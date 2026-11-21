import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUp, ArrowDown, Building, TrendingUp, TrendingDown, AlertTriangle, AlertOctagon, Search } from 'lucide-react';
import RiskAnalysisSection from '../components/RiskAnalysisSection';
import PricePredictionCard from '../components/PricePredictionCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/card';
import { Alert, AlertDescription } from '../components/alert';
import StockSentimentDisplay from '../components/StockSentimentDisplay';
const SentimentAnalysisCard = ({ sentiment }) => {
  if (!sentiment || !sentiment.overall_prediction) {
    return null;
  }

  const score = sentiment.overall_prediction;

  const getSentimentColor = (score) => {
    if (score <= 40) return 'text-red-500';
    if (score >= 60) return 'text-green-500';
    return 'text-yellow-500';
  };

  const getSentimentText = (score) => {
    if (score <= 40) return 'Bearish';
    if (score >= 60) return 'Bullish';
    return 'Neutral';
  };

  const getSentimentIcon = (score) => {
    if (score <= 40) return <TrendingDown className="h-6 w-6" />;
    if (score >= 60) return <TrendingUp className="h-6 w-6" />;
    return <AlertTriangle className="h-6 w-6" />;
  };

  return (
    <Card className="bg-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          {getSentimentIcon(score)}
          <span className="ml-2">Market Sentiment</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <div className={`text-3xl font-bold mb-2 ${getSentimentColor(score)}`}>
            {getSentimentText(score)}
          </div>
          <div className="text-gray-400">
            Sentiment Score: {score.toFixed(1)}
          </div>
          <div className="mt-4 w-full bg-gray-700 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full ${getSentimentColor(score)}`}
              style={{ width: `${score}%` }}
            ></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const StockAnalysis = () => {
  const { symbol } = useParams();
  const [stockDetails, setStockDetails] = useState({
    current_quote: {
      price: 0,
      change: 0,
      change_percent: 0,
    },
    profile: {
      name: '',
      symbol: '',
      industry: '',
      sector: '',
      country: '',
      website: '',
    },
    historical_prices: [],
    news: [],
    country_news: [],
    sentiment: null,
    risk_analysis: null,
    price_prediction: null
  });
  const [loading, setLoading] = useState({
    main: true,
    prediction: false,
    risk: false
  });
  const [errors, setErrors] = useState({
    main: "",
    prediction: "",
    risk: ""
  });

  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const fetchStockData = async () => {
      if (!symbol) {
        setErrors(prev => ({ ...prev, main: "No stock symbol provided" }));
        setLoading(prev => ({ ...prev, main: false }));
        return;
      }

      try {
        setLoading(prev => ({ ...prev, main: true }));
        const response = await fetch(`${process.env.REACT_APP_API_URL}/stocks/details/${symbol}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch stock data: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }

        setStockDetails(prevDetails => ({
          ...prevDetails,
          ...data
        }));
        setErrors(prev => ({ ...prev, main: "" }));
      } catch (err) {
        console.error('Fetch error:', err);
        setErrors(prev => ({ ...prev, main: err.message || "Failed to load stock data" }));
      } finally {
        setLoading(prev => ({ ...prev, main: false }));
      }
    };

    fetchStockData();
  }, [symbol]);

  useEffect(() => {
    if (!searchInput.trim() || searchInput.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await fetch(`${process.env.REACT_APP_API_URL}/stocks/search?name=${encodeURIComponent(searchInput.trim())}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setSuggestions(data.slice(0, 6));
            setShowSuggestions(true);
          }
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    const target = searchInput.trim().toUpperCase();
    setShowSuggestions(false);
    setSearchInput('');
    navigate(`/stocks/${target}`);
  };

  const selectStock = (targetSymbol) => {
    setShowSuggestions(false);
    setSearchInput('');
    navigate(`/stocks/${targetSymbol}`);
  };

  const renderError = (error, type) => {
    if (!error) return null;
    
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertOctagon className="h-4 w-4" />
        <AlertDescription>
          {type === 'prediction' && 'Price Prediction Error: '}
          {type === 'risk' && 'Risk Analysis Error: '}
          {error}
        </AlertDescription>
      </Alert>
    );
  };

  if (loading.main) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (errors.main) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertOctagon className="h-4 w-4" />
        <AlertDescription>{errors.main}</AlertDescription>
      </Alert>
    );
  }

  const isPositiveChange = stockDetails.current_quote.change > 0;
  const currencySymbol = (symbol?.endsWith('.NS') || symbol?.endsWith('.BO') || stockDetails.profile.country === 'India' || stockDetails.profile.currency === 'INR') ? '₹' : '$';

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Quick Search Bar */}
      <div className="relative">
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            placeholder="Search another stock by name or symbol (e.g. RELIANCE, TCS, AAPL)..."
            className="w-full p-3.5 pl-11 pr-10 bg-gray-800 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700 shadow-md"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          {isSearching && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
          )}
        </form>

        {/* Autocomplete Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
            {suggestions.map((item) => (
              <div
                key={item.symbol}
                onClick={() => selectStock(item.symbol)}
                className="px-4 py-3 hover:bg-gray-700/70 cursor-pointer flex justify-between items-center border-b border-gray-700/50 last:border-b-0 transition-colors"
              >
                <div>
                  <span className="font-bold text-blue-400 mr-2">{item.symbol}</span>
                  <span className="text-gray-200 text-sm">{item.name}</span>
                </div>
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded font-medium uppercase">
                  {item.exchange || 'STOCK'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Header Section */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{stockDetails.profile.name}</h1>
            <p className="text-gray-400">{symbol}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{currencySymbol}{stockDetails.current_quote.price.toFixed(2)}</div>
            <div className={`flex items-center justify-end ${isPositiveChange ? 'text-green-500' : 'text-red-500'}`}>
              {isPositiveChange ? <ArrowUp size={20} /> : <ArrowDown size={20} />}
              <span className="ml-1">{Math.abs(stockDetails.current_quote.change_percent).toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Messages */}
      {renderError(errors.prediction, 'prediction')}
      {renderError(errors.risk, 'risk')}

      {/* Analysis Cards Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        <SentimentAnalysisCard sentiment={stockDetails.sentiment} />
        {stockDetails.price_prediction && (
          <PricePredictionCard 
            prediction={stockDetails.price_prediction} 
            loading={loading.prediction}
            error={errors.prediction}
          />
        )}
      </div>

      {/* Price History Chart */}
      {stockDetails.historical_prices.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4">Price History</h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stockDetails.historical_prices}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9CA3AF"
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px'
                  }}
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke={isPositiveChange ? "#10B981" : "#EF4444"}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Company Info */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Building className="mr-2" />
            Company Information
          </h2>
          <div className="space-y-3">
            <p><span className="text-gray-400">Industry:</span> {stockDetails.profile.industry}</p>
            <p><span className="text-gray-400">Sector:</span> {stockDetails.profile.sector}</p>
            <p><span className="text-gray-400">Country:</span> {stockDetails.profile.country}</p>
            <p>
              <span className="text-gray-400">Website:</span> 
              <a href={stockDetails.profile.website} target="_blank" rel="noopener noreferrer" 
                 className="ml-2 text-blue-400 hover:text-blue-300">
                {stockDetails.profile.website}
              </a>
            </p>
          </div>
        </div>

        <StockSentimentDisplay stockDetails={stockDetails} />

        {/* Risk Analysis Section */}
        <RiskAnalysisSection 
          riskAnalysis={stockDetails.risk_analysis}
          loading={loading.risk}
          error={errors.risk}
        />
      </div>
    </div>
  );
};

export default StockAnalysis;