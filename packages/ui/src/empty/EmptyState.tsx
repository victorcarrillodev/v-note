import { Button } from "../components/Button";
import { Illustration, type IllustrationName } from "../design/Illustration";

/** Estado vacío: ilustración, una frase que explica y, si procede, una única acción principal (RF-12.1). */
export function EmptyState({ illustration, title, hint, action }: { illustration: IllustrationName; title: string; hint?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div role="status" className="mx-auto flex max-w-[var(--size-modal-s)] flex-col items-center gap-3 p-8 text-center text-[var(--c-text-muted)]">
      <Illustration name={illustration} />
      <h2 className="text-[length:var(--text-h3-size)] font-semibold text-[var(--c-text)]">{title}</h2>
      {hint && <p className="text-[length:var(--text-ui-size)]">{hint}</p>}
      {action && <Button variant="primary" onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
