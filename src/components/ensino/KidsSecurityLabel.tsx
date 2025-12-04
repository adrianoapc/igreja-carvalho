import { forwardRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KidsSecurityLabelProps {
  crianca: {
    id: string;
    nome: string;
    alergias?: string;
    necessidades_especiais?: string;
  };
  responsavel: {
    nome: string;
    telefone?: string;
  };
  sala: string;
  checkinId: string;
  checkinTime: Date;
}

// Gera código de segurança curto a partir do ID
const gerarCodigoSeguranca = (id: string): string => {
  const letra = String.fromCharCode(65 + (id.charCodeAt(0) % 26));
  const numeros = id.replace(/\D/g, "").slice(0, 3).padStart(3, "0");
  return `${letra}-${numeros}`;
};

const KidsSecurityLabel = forwardRef<HTMLDivElement, KidsSecurityLabelProps>(
  ({ crianca, responsavel, sala, checkinId, checkinTime }, ref) => {
    const codigoSeguranca = gerarCodigoSeguranca(checkinId);

    return (
      <div ref={ref} className="print-labels">
        {/* Etiqueta da Criança */}
        <div className="label-page child-label">
          <div className="label-header">
            <span className="church-name">⛪ Igreja</span>
            <span className="label-date">
              {format(checkinTime, "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </span>
          </div>

          <div className="child-name">{crianca.nome}</div>

          <div className="security-code-large">{codigoSeguranca}</div>

          {(crianca.alergias || crianca.necessidades_especiais) && (
            <div className="alert-box">
              <span className="alert-icon">⚠️</span>
              <span className="alert-text">
                {crianca.alergias || crianca.necessidades_especiais}
              </span>
            </div>
          )}

          <div className="info-row">
            <div className="info-item">
              <span className="info-label">Responsável:</span>
              <span className="info-value">{responsavel.nome}</span>
            </div>
            {responsavel.telefone && (
              <div className="info-item">
                <span className="info-label">Tel:</span>
                <span className="info-value">{responsavel.telefone}</span>
              </div>
            )}
          </div>

          <div className="sala-destino">
            <span className="sala-icon">📍</span>
            <span className="sala-name">{sala}</span>
          </div>
        </div>

        {/* Etiqueta do Pai (Canhoto) */}
        <div className="label-page parent-label">
          <div className="parent-header">AUTORIZAÇÃO DE SAÍDA</div>

          <div className="parent-child-name">{crianca.nome}</div>

          <div className="security-code-large">{codigoSeguranca}</div>

          <div className="parent-instruction">
            Apresente esta etiqueta para retirar a criança
          </div>

          <div className="parent-sala">{sala}</div>
        </div>

        {/* Estilos de impressão */}
        <style>{`
          .print-labels {
            display: none;
          }

          @media print {
            /* Reset geral */
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body * {
              visibility: hidden;
            }

            .print-labels,
            .print-labels * {
              visibility: visible;
            }

            .print-labels {
              display: block !important;
              position: absolute;
              left: 0;
              top: 0;
              width: 80mm;
            }

            @page {
              size: 80mm auto;
              margin: 2mm;
            }

            .label-page {
              width: 76mm;
              padding: 3mm;
              border: 1px dashed #000;
              page-break-after: always;
              font-family: Arial, sans-serif;
              color: #000;
              background: #fff;
            }

            .label-header {
              display: flex;
              justify-content: space-between;
              font-size: 8pt;
              margin-bottom: 2mm;
              border-bottom: 1px solid #000;
              padding-bottom: 1mm;
            }

            .church-name {
              font-weight: bold;
            }

            .child-name {
              font-size: 14pt;
              font-weight: bold;
              text-align: center;
              margin: 3mm 0;
              text-transform: uppercase;
            }

            .security-code-large {
              font-size: 24pt;
              font-weight: bold;
              text-align: center;
              padding: 3mm;
              border: 2px solid #000;
              margin: 3mm 0;
              letter-spacing: 2mm;
              font-family: monospace;
            }

            .alert-box {
              background: #000;
              color: #fff;
              padding: 2mm;
              margin: 2mm 0;
              display: flex;
              align-items: center;
              gap: 2mm;
              font-size: 9pt;
            }

            .alert-icon {
              font-size: 12pt;
            }

            .alert-text {
              font-weight: bold;
            }

            .info-row {
              font-size: 9pt;
              margin: 2mm 0;
            }

            .info-item {
              margin: 1mm 0;
            }

            .info-label {
              font-weight: bold;
            }

            .sala-destino {
              text-align: center;
              font-size: 12pt;
              font-weight: bold;
              margin-top: 3mm;
              padding: 2mm;
              border-top: 1px dashed #000;
            }

            .sala-icon {
              margin-right: 1mm;
            }

            /* Etiqueta do Pai */
            .parent-label {
              text-align: center;
            }

            .parent-header {
              font-size: 10pt;
              font-weight: bold;
              padding: 2mm;
              background: #000;
              color: #fff;
              margin-bottom: 3mm;
            }

            .parent-child-name {
              font-size: 11pt;
              font-weight: bold;
              margin: 2mm 0;
            }

            .parent-instruction {
              font-size: 8pt;
              margin: 3mm 0;
              font-style: italic;
            }

            .parent-sala {
              font-size: 9pt;
              margin-top: 2mm;
              padding-top: 2mm;
              border-top: 1px dashed #000;
            }
          }
        `}</style>
      </div>
    );
  }
);

KidsSecurityLabel.displayName = "KidsSecurityLabel";

export default KidsSecurityLabel;
