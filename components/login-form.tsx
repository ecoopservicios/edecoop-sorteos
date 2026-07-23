"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";

export function LoginForm({ hasError, sessionExpired }: { hasError?: boolean; sessionExpired?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function submit(_event: FormEvent<HTMLFormElement>) {
    setLoading(true);
  }

  return (
    <form
      onSubmit={submit}
      action="/api/auth/login-form"
      method="post"
      autoComplete="on"
      name="login"
      id="login-form"
      className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-950">Acceso</h1>
      </div>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">Correo</span>
        <input
          id="username"
          name="username"
          type="email"
          required
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-700"
        />
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">Contraseña</span>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-slate-300 px-3 py-2 pr-11 outline-none focus:border-emerald-700"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
            aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
            title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>
      {sessionExpired ? (
        <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          La sesión caducó o el navegador fue reiniciado. Debe iniciar sesión nuevamente.
        </p>
      ) : null}
      {hasError ? <p className="mb-4 text-sm font-semibold text-red-700">Usuario o contraseña incorrectos.</p> : null}
      <button
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        <LogIn size={18} />
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
