import { useState } from "react";
import type { ApplicationController } from "../../utils/application/useApplication";
import "./EmployerAccountSetup.css";

export function EmployerAccountSetup({ controller }: { controller: ApplicationController }) {
  const { session, applyBusy, prepareAccountSignUp, setEmployerAccountStatus } = controller;
  const [password, setPassword] = useState("");
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  if (!session?.employerAccount) return null;
  const account = session.employerAccount;
  const signup = session.signupPrepared;
  function generatePassword() {
    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_";
    const random = new Uint8Array(24);
    crypto.getRandomValues(random);
    setPassword(Array.from(random, n => charset[n % charset.length]).join(""));
    setGenerated(true);
    setCopied(false);
  }
  async function copyPassword() {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
  }
  async function prepare() {
    if (generated && !copied) return;
    await prepareAccountSignUp(password || undefined);
    // A one-time credential is never retained in the app's persistent state.
    setPassword("");
    setGenerated(false);
    setCopied(false);
  }
  return (
    <section className="employer-account-panel">
      <h3>Employer account — {account.employerName}</h3>
      <p>{account.provider} · {account.host}</p>
      {account.status === "ready" ? (
        <p>Your account is ready. Sign in on the employer’s site when prompted.</p>
      ) : (
        <>
          <p>This employer requires an account. We can help fill out supported signup forms; you’ll complete verification and confirm account creation.</p>
          <label htmlFor="account-signup-password">Account password (optional)</label>
          <div className="employer-account-password">
            <input id="account-signup-password" type={visible ? "text" : "password"}
              value={password} onChange={event => { setPassword(event.target.value); setGenerated(false); setCopied(false); }}
              autoComplete="new-password" placeholder="Leave blank to use your password manager" />
            <button type="button" disabled={applyBusy} onClick={generatePassword}>Generate</button>
            <button type="button" disabled={!password || applyBusy} onClick={() => setVisible(v => !v)}>{visible ? "Hide" : "Show"}</button>
            <button type="button" disabled={!password || applyBusy} onClick={() => void copyPassword()}>{copied ? "Copied" : "Copy"}</button>
          </div>
          {generated && !copied && <p className="validation warning">Copy and save the generated password in your password manager before preparing signup.</p>}
          <button className="secondary" type="button" disabled={applyBusy || (generated && !copied) || (password.length > 0 && password.length < 12)}
            onClick={() => void prepare()}>Fill signup form</button>
          {signup?.state === "manual_required" && (
            <p>Prepared: {signup.filled.length ? signup.filled.join(", ") : "registration page opened"}. Finish any terms, verification, and final Create Account action in the employer browser.</p>
          )}
          {signup?.state === "unavailable" && <p className="validation warning">Registration autofill stopped: the browser is outside the original employer site.</p>}
          <button className="secondary" type="button" disabled={applyBusy}
            onClick={() => void setEmployerAccountStatus("ready")}>I've created this account</button>
        </>
      )}
      {account.status === "ready" && (
        <button className="secondary" type="button" disabled={applyBusy}
          onClick={() => void setEmployerAccountStatus("setup_required")}>Account needs setup</button>
      )}
      <p>Your password is never saved here. Complete verification and account creation on the employer’s site.</p>
    </section>
  );
}
