import { motion, AnimatePresence } from "framer-motion";
import { Upload, Sparkles, FileSearch, CheckCircle } from "lucide-react";

export type AIProcessingStep = 'idle' | 'uploading' | 'analyzing' | 'extracting' | 'filling';

interface AIProcessingOverlayProps {
  currentStep: AIProcessingStep;
}

const steps = [
  { key: 'uploading', icon: Upload, text: 'Enviando documento...' },
  { key: 'analyzing', icon: Sparkles, text: 'IA analisando...' },
  { key: 'extracting', icon: FileSearch, text: 'Extraindo dados...' },
  { key: 'filling', icon: CheckCircle, text: 'Preenchendo campos...' },
] as const;

export function AIProcessingOverlay({ currentStep }: AIProcessingOverlayProps) {
  if (currentStep === 'idle') return null;

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);
  const CurrentIcon = steps[currentStepIndex]?.icon || Sparkles;
  const currentText = steps[currentStepIndex]?.text || 'Processando...';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="bg-card border border-border rounded-xl p-6 shadow-lg max-w-xs w-full mx-4 text-center"
        >
          {/* Ícone animado */}
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
            }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
          >
            <CurrentIcon className="w-8 h-8 text-primary" />
          </motion.div>

          {/* Texto da etapa atual */}
          <motion.p
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-foreground font-medium mb-4"
          >
            {currentText}
          </motion.p>

          {/* Indicadores de etapa */}
          <div className="flex justify-center gap-2 mb-4">
            {steps.map((step, index) => (
              <motion.div
                key={step.key}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  index <= currentStepIndex 
                    ? 'bg-primary' 
                    : 'bg-muted-foreground/30'
                }`}
                animate={index === currentStepIndex ? {
                  scale: [1, 1.3, 1],
                } : {}}
                transition={{ 
                  duration: 0.8, 
                  repeat: index === currentStepIndex ? Infinity : 0,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>

          {/* Barra de progresso */}
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: "0%" }}
              animate={{ 
                width: `${((currentStepIndex + 1) / steps.length) * 100}%` 
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            Aguarde, estamos processando sua nota fiscal
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
