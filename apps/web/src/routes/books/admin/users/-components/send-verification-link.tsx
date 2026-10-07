import { useState } from "react";
import { sendUserVerificationEmail } from "./users-fn.ts";

// "No" for a user who hasn't verified their email - a link that emails them
// a verification link (again).
export function SendVerificationLink({ user }: { user: { id: string; email: string } }) {
  const [state, setState] = useState<
    { status: "idle" } | { status: "sending" } | { status: "sent" } | { status: "error"; message: string }
  >({ status: "idle" });

  if (state.status === "sent") {
    return <span className="text-muted-foreground">Email sent</span>;
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        className="cursor-pointer text-primary underline underline-offset-2 hover:no-underline disabled:cursor-wait disabled:opacity-60"
        disabled={state.status === "sending"}
        title={`Email ${user.email} a link to verify their address`}
        onClick={async () => {
          setState({ status: "sending" });
          try {
            await sendUserVerificationEmail({ data: user.id });
            setState({ status: "sent" });
          } catch (caught) {
            setState({
              status: "error",
              message: caught instanceof Error ? caught.message : "Couldn't send the email.",
            });
          }
        }}
      >
        {state.status === "sending" ? "Sending..." : "No - send verification email"}
      </button>
      {state.status === "error" ? (
        <span className="text-xs text-destructive" role="alert">
          {state.message}
        </span>
      ) : null}
    </span>
  );
}
