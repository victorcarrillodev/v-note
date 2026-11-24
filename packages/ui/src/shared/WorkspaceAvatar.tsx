import { monogram } from "../layout/monogram";
import { workspaceColorForName, type WorkspaceAvatarColor } from "./workspaceAvatar";

/** Inicial del título del espacio con color vibrante generado algorítmicamente. */
export function WorkspaceAvatar({ name, color, size = 20 }: { name: string; color?: WorkspaceAvatarColor; size?: number }) {
  const resolved = color ?? workspaceColorForName(name);
  const fontSize = Math.max(10, Math.round(size * 0.55));
  return (
    <span
      aria-hidden="true"
      data-workspace-avatar
      data-workspace-hue={resolved.hue}
      style={{ width: size, height: size, fontSize, background: resolved.background, color: resolved.foreground }}
      className="inline-flex shrink-0 select-none items-center justify-center rounded-[var(--radius-md)] font-semibold leading-none"
    >
      {monogram(name)}
    </span>
  );
}
