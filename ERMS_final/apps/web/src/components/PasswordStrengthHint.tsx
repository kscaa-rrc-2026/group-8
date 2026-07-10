// Mirrors apps/api/src/lib/password.ts's passwordSchema exactly - keep
// both in sync if the rule ever changes.
const RULES: { label: string; test: (pw: string) => boolean }[] = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "At least one uppercase letter (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { label: "At least one lowercase letter (a-z)", test: (pw) => /[a-z]/.test(pw) },
  { label: "At least one number (0-9)", test: (pw) => /[0-9]/.test(pw) },
  { label: "At least one special character (e.g. ! @ # $ % ^ & *)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export function passwordMeetsRules(password: string): boolean {
  return RULES.every((rule) => rule.test(password));
}

export function PasswordStrengthHint({ password }: { password: string }) {
  return (
    <ul className="text-xs space-y-0.5 mb-3">
      {RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.label} className={met ? "text-status-approved" : "text-slate-400"}>
            {met ? "✓" : "○"} {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
