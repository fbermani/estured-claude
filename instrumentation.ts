import { installLogRedaction } from "@/lib/logging/redactLogArg";

/** Next llama a `register` una vez al arrancar el servidor. */
export function register() {
  installLogRedaction();
}
