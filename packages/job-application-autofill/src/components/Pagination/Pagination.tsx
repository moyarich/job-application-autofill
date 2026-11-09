import { ChevronLeft, ChevronRight } from "lucide-react";
import "./Pagination.css";

type PaginationProps = {
  page: number;
  pageCount: number;
  start: number;
  end: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export function Pagination({
  page, pageCount, start, end, total, pageSize, onPageChange, onPageSizeChange,
}: PaginationProps) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (value) => value === 1 || value === pageCount || Math.abs(value - page) <= 1,
  );
  return (
    <nav className="pagination" aria-label="Application pages">
      <span className="pagination-summary" aria-live="polite">
        {total === 0 ? "0 applications" : `Showing ${start}–${end} of ${total} applications`}
      </span>
      <label className="pagination-page-size">
        Rows per page
        <select
          aria-label="Rows per page"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {[5, 10, 25, 50].map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </label>
      <div className="pagination-buttons">
        <button type="button" aria-label="Previous page" disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={16} />
        </button>
        {pages.map((value, index) => (
          <span className="pagination-slot" key={value}>
            {index > 0 && value > pages[index - 1] + 1 && (
              <span className="pagination-ellipsis" aria-hidden="true">…</span>
            )}
            <button type="button" aria-label={`Page ${value}`}
              aria-current={page === value ? "page" : undefined}
              onClick={() => onPageChange(value)}>{value}</button>
          </span>
        ))}
        <button type="button" aria-label="Next page" disabled={page >= pageCount || total === 0}
          onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
