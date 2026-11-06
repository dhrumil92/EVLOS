// Asks before a change that cannot be undone from the page. Used on the Settings page.
export function Confirm(props: {
  question: string;
  yes: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="danger-zone grid gap-3" role="group" aria-label="Confirm">
      <p className="font-display text-xl font-semibold">{props.question}</p>
      <div className="flex flex-wrap gap-3">
        <button className="btn" type="button" onClick={props.onYes}>
          {props.yes}
        </button>
        <button className="btn-quiet" type="button" onClick={props.onNo}>
          Cancel
        </button>
      </div>
    </div>
  );
}
