import { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";

export default function useLiveStats(refreshMs = 60000) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let interval;

    const fetchStats = async () => {
      try {
        const { data } = await axiosClient.get("/stats");
        setStats(data);
        setError(null);
      } catch (err) {
        setError("Live stats load nahi ho sakay");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    interval = setInterval(fetchStats, refreshMs);

    return () => clearInterval(interval);
  }, [refreshMs]);

  return { stats, loading, error };
}
