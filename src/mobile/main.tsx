import { createRoot } from "react-dom/client";
import { MobileApp } from "./MobileApp";
import "../styles/index.css";
import "./mobile.css";

createRoot(document.getElementById("root")!, {
  onRecoverableError(error) {
    console.error(
      "[monocode mobile] render recovery",
      error instanceof Error && "cause" in error ? error.cause : error,
    );
  },
}).render(<MobileApp />);
