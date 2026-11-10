import type { ApplicationReviewData } from "../feature-props";
import { ArrowRight, UserPlus } from "lucide-react";
import "./EmployerAccountSetup.css";

export function EmployerAccountSetup({
  controller,
}: {
  controller: ApplicationReviewData;
}) {
  const { session, applyBusy, prepareAccountSignUp, continueAfterChallenge } =
    controller;
  if (!session?.employerAccount) return null;
  const account = session.employerAccount;
  const signup = session.signupPrepared;
  const prepared = signup?.state === "manual_required";
  return (
    <section className="employer-account-panel" aria-label="Employer sign-in">
      <div className="account-next-step">
        <div>
          <h3>
            {prepared
              ? "Finish account setup"
              : "Employer sign-in needs attention"}
          </h3>
          <p>
            {prepared
              ? "Review the account fields and any employer message in the browser, then resume autofill."
              : "Automation uses your configured credentials. Review the employer message in the browser below, then resume autofill."}
          </p>
        </div>
        <div className="actions">
          <button
            className="secondary"
            type="button"
            disabled={applyBusy}
            onClick={() => void prepareAccountSignUp()}
          >
            <UserPlus size={16} /> Retry signup
          </button>
          <button
            className="primary"
            type="button"
            disabled={applyBusy}
            onClick={continueAfterChallenge}
          >
            Resume autofill <ArrowRight size={16} />
          </button>
        </div>
      </div>
      {signup?.credentialSource === "configured" && (
        <p className="account-prepared-note">
          Configured account details filled on {account.host}.
        </p>
      )}
      {signup?.missing?.length ? (
        <p className="account-prepared-note">
          Complete the remaining fields in the employer browser.
        </p>
      ) : null}
      {signup?.state === "unavailable" && (
        <p role="alert">
          Return to the employer website to fill account details.
        </p>
      )}
    </section>
  );
}
