"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface IPContextType {
  ipHost: string;
  ipLoading: boolean;
}

const IPContext = createContext<IPContextType>({ ipHost: "", ipLoading: true });

export const IPProvider = ({ children }: { children: ReactNode }) => {
  const [ipHost, setIpHost] = useState("");
  const [ipLoading, setIpLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:3000/external-config")
      .then(res => res.json())
      .then(data => setIpHost(data.server_host))
      .catch(console.error)
      .finally(() => setIpLoading(false));
  }, []);

  return (
    <IPContext.Provider value={{ ipHost, ipLoading }}>
      {children}
    </IPContext.Provider>
  );
};

export const useIP = () => useContext(IPContext);
