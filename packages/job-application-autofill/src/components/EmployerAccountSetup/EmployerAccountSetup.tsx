import type { ApplicationReviewData } from "../feature-props";
import { useState } from "react";
import { ArrowRight, UserPlus } from "lucide-react";
import "./EmployerAccountSetup.css";

export function EmployerAccountSetup({ controller }: { controller: ApplicationReviewData }) {
  const { session, applyBusy, prepareAccountSignUp, continueAfterChallenge } = controller;
  const [password, setPassword] = useState("");
  if (!session?.employerAccount) return null;
  const account = session.employerAccount;
  const signup = session.signupPrepared;
  const prepared = signup?.state === "manual_required";
  return (
    <section className="employer-account-panel" aria-label="Employer sign-in">
      <div className="account-next-step">
        <div><h3>{prepared ? "Finish account verification" : "Employer sign-in needs attention"}</h3>
          <p>{prepared
            ? "Review the filled details in the browser, complete verification, then continue."
            : "Automation uses your configured credentials. Review the employer message in the browser below, then continue."}</p>
        </div>
        <div className="actions">
          {!prepared && <button className="secondary" type="button" disabled={applyBusy} onClick={() => void prepareAccountSignUp()}><UserPlus size={16} /> Retry signup</button>}
          <button className="primary" type="button" disabled={applyBusy} onClick={continueAfterChallenge}>Continue <ArrowRight size={16} /></button>
        </div>
      </div>
      {signup?.credentialSource === "configured" && <p className="account-prepared-note">Configured account details filled on {account.host}.</p>}
      {signup?.missing?.length ? <p className="account-prepared-note">Complete the remaining fields in the employer browser.</p> : null}
      {signup?.state === "unavailable" && <p role="alert">Return to the employer website to fill account details.</p>}
      <details className="account-other-password">
        <summary>Use a different password</summary>
        <label htmlFor="account-signup-password">Password for this signup
          <input id="account-signup-password" type="password" value={password}
            onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
        </label>
        <button className="secondary" type="button" disabled={applyBusy || password.length < 12 || password.length > 128}
          onClick={async () => { await prepareAccountSignUp(password); setPassword(""); }}>Fill with this password</button>
      </details>
    </section>
  );
}
