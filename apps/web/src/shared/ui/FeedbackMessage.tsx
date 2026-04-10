import { normalizarMensajeUsuario } from "./normalizarMensaje";

export type FeedbackTipo = "success" | "error" | "warning";

export type FeedbackState = { tipo: FeedbackTipo; text: string };

type Props = {
  feedback: FeedbackState | null;
  className?: string;
};

export function FeedbackMessage({ feedback, className = "" }: Props) {
  if (!feedback) return null;
  const text = normalizarMensajeUsuario(feedback.text);
  const role = feedback.tipo === "error" ? "alert" : "status";
  return (
    <p className={`message message--${feedback.tipo} ${className}`.trim()} role={role}>
      {text}
    </p>
  );
}
