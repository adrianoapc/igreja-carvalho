import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: PasswordRequirement[] = [
  { label: "Mínimo 6 caracteres", test: (p) => p.length >= 6 },
  { label: "Uma letra maiúscula", test: (p) => /[A-Z]/.test(p) },
  { label: "Um número", test: (p) => /\d/.test(p) },
];

export function calculatePasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!password) {
    return { score: 0, label: "", color: "" };
  }

  let score = 0;
  
  // Comprimento
  if (password.length >= 6) score += 1;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  
  // Complexidade
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  // Normalizar para 0-4
  const normalizedScore = Math.min(4, Math.floor(score / 2));

  const levels = [
    { label: "Muito fraca", color: "bg-destructive" },
    { label: "Fraca", color: "bg-orange-500" },
    { label: "Média", color: "bg-yellow-500" },
    { label: "Forte", color: "bg-green-500" },
    { label: "Muito forte", color: "bg-green-600" },
  ];

  return {
    score: normalizedScore,
    label: levels[normalizedScore].label,
    color: levels[normalizedScore].color,
  };
}

export function PasswordStrengthIndicator({ 
  password, 
  showRequirements = true 
}: PasswordStrengthIndicatorProps) {
  const strength = calculatePasswordStrength(password);

  if (!password) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Barra de força */}
      <div className="space-y-1">
        <div className="flex gap-1 h-1.5">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={cn(
                "flex-1 rounded-full transition-all duration-300",
                index <= strength.score ? strength.color : "bg-muted"
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Força: <span className="font-medium">{strength.label}</span>
        </p>
      </div>

      {/* Requisitos */}
      {showRequirements && password.length > 0 && (
        <div className="space-y-1">
          {requirements.map((req, index) => {
            const passed = req.test(password);
            return (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-1.5 text-xs transition-colors",
                  passed ? "text-green-600" : "text-muted-foreground"
                )}
              >
                {passed ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <X className="w-3 h-3" />
                )}
                <span>{req.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
