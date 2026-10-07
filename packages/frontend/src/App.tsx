import { useState } from "react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { config } from "./config";
import { TokenOverview } from "./components/TokenOverview";
import { CapTable } from "./components/CapTable";
import { InvestorManager } from "./components/InvestorManager";
import { IssuerControls } from "./components/IssuerControls";
import { InvestorPortal } from "./components/InvestorPortal";
import { IssuerDividends } from "./components/IssuerDividends";

type Mode = "issuer" | "investor";
type Tab = "overview" | "investors" | "controls" | "dividends";

export default function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [mode, setMode] = useState<Mode>("issuer");
  const [tab, setTab] = useState<Tab>("overview");

  const wrongNetwork = isConnected && chainId !== config.chainId;

  return (
    <div className="container">
      <header className="topbar">
        <div>
          <h1>AssetGate</h1>
          <p className="subtitle mono">token {config.token.slice(0, 10)}… · chain {config.chainId}</p>
        </div>
        <div className="row">
          <div className="tabs">
            <button className={mode === "issuer" ? "active" : ""} onClick={() => setMode("issuer")}>Issuer</button>
            <button className={mode === "investor" ? "active" : ""} onClick={() => setMode("investor")}>Investor</button>
          </div>
          {!isConnected ? (
            <button onClick={() => connect({ connector: connectors[0] })}>Connect</button>
          ) : (
            <div className="row">
              <span className="mono small">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
              <button onClick={() => disconnect()}>Disconnect</button>
            </div>
          )}
        </div>
      </header>

      {wrongNetwork && (
        <div className="banner">Wrong network ({chainId}). <button onClick={() => switchChain({ chainId: config.chainId })}>Switch to {config.chainId}</button></div>
      )}

      {mode === "issuer" ? (
        <>
          <nav className="tabs">
            <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Overview</button>
            <button className={tab === "investors" ? "active" : ""} onClick={() => setTab("investors")}>Investors</button>
            <button className={tab === "controls" ? "active" : ""} onClick={() => setTab("controls")}>Controls</button>
            <button className={tab === "dividends" ? "active" : ""} onClick={() => setTab("dividends")}>Dividends</button>
          </nav>
          {tab === "overview" && (<><TokenOverview /><h2>Cap table</h2><CapTable /></>)}
          {tab === "investors" && (isConnected && !wrongNetwork ? <InvestorManager /> : <p className="muted">Connect the issuer wallet on chain {config.chainId}.</p>)}
          {tab === "controls" && (isConnected && !wrongNetwork ? <IssuerControls /> : <p className="muted">Connect the issuer wallet on chain {config.chainId}.</p>)}
          {tab === "dividends" && (isConnected && !wrongNetwork ? <IssuerDividends /> : <p className="muted">Connect the issuer wallet.</p>)}
        </>
      ) : (
        wrongNetwork ? <p className="muted">Switch to chain {config.chainId} to use the investor portal.</p> : <InvestorPortal />
      )}
    </div>
  );
}