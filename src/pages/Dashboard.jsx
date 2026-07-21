import useLiveStats from "../hooks/useLiveStats";

export default function Dashboard() {
  const { stats, loading, error } = useLiveStats(60000);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Live Stats Dashboard</h1>
      <p className="text-white/60 mb-8">
        Har 60 second baad auto-refresh hota hai.
      </p>

      {loading && <p className="text-white/50">Load ho raha hai...</p>}
      {error && <p className="text-red-400">{error}</p>}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-injective-card border border-white/10 rounded-xl p-6">
            <p className="text-white/50 text-sm mb-1">INJ Price (USD)</p>
            <p className="text-3xl font-bold">
              {stats.price ? `$${stats.price.price.toFixed(2)}` : "N/A"}
            </p>
            {stats.price && (
              <p
                className={
                  stats.price.change24h >= 0 ? "text-green-400 mt-1" : "text-red-400 mt-1"
                }
              >
                {stats.price.change24h?.toFixed(2)}% (24h)
              </p>
            )}
          </div>

          <div className="bg-injective-card border border-white/10 rounded-xl p-6">
            <p className="text-white/50 text-sm mb-1">Market Cap</p>
            <p className="text-3xl font-bold">
              {stats.price?.marketCap
                ? `$${stats.price.marketCap.toLocaleString()}`
                : "N/A"}
            </p>
          </div>

          <div className="bg-injective-card border border-white/10 rounded-xl p-6">
            <p className="text-white/50 text-sm mb-1">Total Staked INJ</p>
            <p className="text-3xl font-bold">
              {stats.staked ? stats.staked.toLocaleString() : "N/A"}
            </p>
          </div>

          <div className="bg-injective-card border border-white/10 rounded-xl p-6">
            <p className="text-white/50 text-sm mb-1">Total Supply</p>
            <p className="text-3xl font-bold">
              {stats.totalSupply ? stats.totalSupply.toLocaleString() : "N/A"}
            </p>
          </div>
        </div>
      )}

      {stats?.updatedAt && (
        <p className="text-white/30 text-xs mt-6">
          Last updated: {new Date(stats.updatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
