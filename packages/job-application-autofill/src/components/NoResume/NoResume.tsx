import { Link } from "react-router";
import { routes } from "../../routes";
import "./NoResume.css";

export function NoResume() {
  return (
    <section className="panel no-resume" aria-label="No resume selected">
      <h2>No resume selected</h2>
      <Link className="primary" to={routes.resumes}>Go to resumes</Link>
    </section>
  );
}
