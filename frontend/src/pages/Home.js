import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { Toaster, toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

const Home = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [marketData, setMarketData] = useState({
    nifty50: { historical: [], current: {} },
    sensex: { historical: [], current: {} },
    topStocks: [
      {
        symbol: "INFY.NS",
        name: "Infosys",
        price: 1842.75,
        change: 3.8
      },
      {
        symbol: "HDFCBANK.NS",
        name: "HDFC Bank",
        price: 2756.30,
        change: 2.9
      },
      {
        symbol: "TCS.NS",
        name: "TCS",
        price: 3654.90,
        change: 4.2
      },
      {
        symbol: "RELIANCE.NS",
        name: "Reliance",
        price: 2463.15,
        change: -1.2
      },
      {
        symbol: "WIPRO.NS",
        name: "Wipro",
        price: 456.80,
        change: 1.7
      }
    ]
  });


  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/market/market-overview`);
        if (!response.ok) {
          throw new Error('Market data fetch failed');
        }
        const data = await response.json();
        // Keep topStocks hardcoded, update other market data
        setMarketData(prevData => ({
          ...data,
          topStocks: prevData.topStocks
        }));
      } catch (error) {
        console.error("Error fetching market data:", error);
        toast.error("Unable to fetch market data");
      }
    };

    fetchMarketData();
    const timer = setTimeout(() => setShowContent(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    if (!e.target.value.trim()) {
      setSearchPerformed(false);
      setSearchResults([]);
    }
  };

  const executeSearch = async (searchTerm) => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchResults([]);
      setSearchPerformed(false);
      toast.error("Please enter a stock name or symbol");
      return;
    }
    setLoading(true);
    setSearchPerformed(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/stocks/search?name=${encodeURIComponent(term)}`);
      
      if (!response.ok) {
        throw new Error('Stock search failed');
      }
      
      const data = await response.json();
      
      if (Array.isArray(data) && data.length === 0) {
        toast.info("No stocks found matching your search");
      } else if (Array.isArray(data)) {
        setSearchResults(data);
        toast.success(`Found ${data.length} matching stocks`);
      } else if (data.error) {
        toast.error(data.error);
      }
      
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching search results:", error);
      toast.error("Unable to fetch stock results. Please try again.");
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleChipClick = (stockSymbol) => {
    setQuery(stockSymbol);
    executeSearch(stockSymbol);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gray-800/80 backdrop-blur-lg p-4 rounded-xl shadow-2xl border border-gray-700"
        >
          <p className="text-gray-300 mb-1">{label}</p>
          <p className="text-green-500 font-bold text-lg">₹{payload[0].value.toFixed(2)}</p>
        </motion.div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white min-h-screen overflow-hidden">
      <Toaster 
        position="top-right"
        toastOptions={{
          success: { duration: 3000 },
          error: { duration: 5000 }
        }} 
      />
      <AnimatePresence>
        {!showContent && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <motion.div
              animate={{ rotate: 360, scale: [1, 1.2, 1] }}
              transition={{ 
                duration: 2, 
                ease: "easeInOut",
                repeat: Infinity
              }}
            >
              <TrendingUp size={80} className="text-amber-500" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="container mx-auto px-4 py-8"
          >
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="max-w-2xl mx-auto bg-gray-800/40 backdrop-blur-lg rounded-3xl p-8 shadow-2xl mb-8"
            >
              <h1 className="text-5xl font-bold mb-8 text-center bg-gradient-to-r from-amber-500 to-amber-300 bg-clip-text text-transparent">
                Stock Insights
              </h1>
              
              <form onSubmit={handleSearch} className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    placeholder="Search any stock by name or symbol (e.g. TCS, Reliance, Tata Motors, Apple)..."
                    className="w-full p-4 pl-12 pr-12 bg-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-inner"
                  />
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    type="submit"
                    disabled={loading}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="animate-spin h-5 w-5 border-2 border-amber-500 border-t-transparent rounded-full" />
                    ) : (
                      <Search />
                    )}
                  </motion.button>
                </div>
              </form>

              {/* Popular Search Suggestions */}
              <div className="flex flex-wrap gap-2 justify-center items-center">
                <span className="text-xs text-gray-400 font-medium">Trending:</span>
                {['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'Tata Motors', 'Zomato', 'AAPL', 'NVDA'].map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => handleChipClick(pill)}
                    className="text-xs bg-gray-700/60 hover:bg-amber-500/20 hover:text-amber-300 text-gray-300 px-3 py-1 rounded-full border border-gray-600/50 transition-all cursor-pointer"
                  >
                    {pill}
                  </button>
                ))}
              </div>
            </motion.div>

            {loading && (
              <div className="flex justify-center items-center py-6 mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
                <span className="ml-3 text-gray-300">Searching stocks...</span>
              </div>
            )}

            {searchPerformed && !loading && searchResults.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/40 backdrop-blur-lg rounded-2xl p-6 text-center max-w-xl mx-auto mb-8 border border-gray-700/50"
              >
                <p className="text-gray-300 text-lg mb-2">No stocks found matching "{query}"</p>
                <p className="text-sm text-gray-400">Try searching by company name (e.g. Reliance, TCS, Tata Motors) or ticker symbol (e.g. INFY.NS, AAPL).</p>
              </motion.div>
            )}

            {searchPerformed && searchResults.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
              >
                {searchResults.map((stock) => (
                  <motion.div
                    key={stock.symbol}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => navigate(`/stocks/${stock.symbol}`)}
                    className="bg-gray-800/60 backdrop-blur-lg rounded-xl p-5 shadow-xl hover:bg-gray-700/60 border border-gray-700/50 hover:border-amber-500/50 cursor-pointer transform transition-all hover:scale-105"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-bold text-amber-400">{stock.symbol}</h3>
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded uppercase font-semibold">
                        {stock.exchange || 'STOCK'}
                      </span>
                    </div>
                    <p className="text-gray-200 text-sm mb-2 line-clamp-2">{stock.name}</p>
                    <p className="text-xs text-amber-500/80 font-medium">Click to view AI analysis &rarr;</p>
                  </motion.div>
                ))}
              </motion.div>
            )}
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Nifty 50 Chart */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-gray-800/40 backdrop-blur-lg rounded-3xl p-6 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">Nifty 50</h2>
                  <div className={`flex items-center ${marketData.nifty50.current.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {marketData.nifty50.current.changePercent >= 0 ? <ArrowUp className="mr-2" /> : <ArrowDown className="mr-2" />}
                    {Math.abs(marketData.nifty50.current.changePercent || 0).toFixed(2)}%
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={marketData.nifty50.historical}>
                      <defs>
                        <linearGradient id="niftyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="Date" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="Close" 
                        stroke="#22c55e" 
                        fillOpacity={1} 
                        fill="url(#niftyGradient)"
                        strokeWidth={3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
              {/* Sensex Chart */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 }}
                className="bg-gray-800/40 backdrop-blur-lg rounded-3xl p-6 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">Sensex</h2>
                  <div className={`flex items-center ${marketData.sensex.current.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {marketData.sensex.current.changePercent >= 0 ? <ArrowUp className="mr-2" /> : <ArrowDown className="mr-2" />}
                    {Math.abs(marketData.sensex.current.changePercent || 0).toFixed(2)}%
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={marketData.sensex.historical}>
                      <defs>
                        <linearGradient id="sensexGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="Date" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="Close" 
                        stroke="#3b82f6" 
                        fillOpacity={1} 
                        fill="url(#sensexGradient)"
                        strokeWidth={3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>
            {/* Top Stocks Section */}
            <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
        className="bg-gray-800/40 backdrop-blur-lg rounded-3xl p-6 shadow-2xl"
      >
        <h2 className="text-2xl font-bold mb-6">Top Performing Stocks</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {marketData.topStocks.map((stock, index) => (
            <motion.div
              key={stock.symbol}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 + index * 0.1 }}
              onClick={() => navigate(`/stocks/${stock.symbol}`)}
              className="bg-gray-700/50 hover:bg-gray-700/80 cursor-pointer transform transition-all hover:scale-105 rounded-xl p-4 text-center border border-transparent hover:border-amber-500/30"
              title={`Click to view analysis for ${stock.symbol}`}
            >
              <div className="font-bold text-lg mb-1">{stock.symbol}</div>
              {stock.name && <div className="text-xs text-gray-400 mb-1">{stock.name}</div>}
              <div className="text-xl mb-2">₹{stock.price.toFixed(2)}</div>
              <div className={`flex items-center justify-center ${stock.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stock.change >= 0 ? <ArrowUp className="mr-1" /> : <ArrowDown className="mr-1" />}
                {Math.abs(stock.change).toFixed(2)}%
              </div>
            </motion.div>
          ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;