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
              ? "Finish account verification"
              : "Employer sign-in needs attention"}
          </h3>
          <p>
            {prepared
              ? "Review the filled details in the browser, complete verification, then continue."
              : "Automation uses your configured credentials. Review the employer message in the browser below, then continue."}
          </p>
        </div>
        <div className="actions">
          {!prepared && (
            <button
              className="secondary"
              type="button"
              disabled={applyBusy}
              onClick={() => void prepareAccountSignUp()}
            >
              <UserPlus size={16} /> Retry signup
            </button>
          )}
          <button
            className="primary"
            type="button"
            disabled={applyBusy}
            onClick={continueAfterChallenge}
          >
            Continue <ArrowRight size={16} />
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
