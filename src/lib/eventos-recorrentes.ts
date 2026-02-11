import { addDays, addWeeks, addMonths, addYears } from "date-fns";

export type TipoRecorrencia = "diaria" | "semanal" | "mensal" | "anual";
export type FimRecorrencia = "ocorrencias" | "ate_data";

export interface ConfigRecorrencia {
  dataInicial: Date;
  horaInicio: string; // "HH:mm"
  tipo: TipoRecorrencia;
  intervalo: number; // Ex: 1 = toda semana, 2 = a cada 2 semanas
  fimTipo: FimRecorrencia;
  numOcorrencias?: number; // Usado quando fimTipo = 'ocorrencias'
  dataFim?: Date; // Usado quando fimTipo = 'ate_data'
  diasSemana?: number[]; // 0=Dom, 1=Seg, ... 6=Sab (para recorrência semanal personalizada)
}

/**
 * Gera array de datas baseado em configuração de recorrência
 * @param config Configuração de recorrência
 * @returns Array de objetos Date com as datas geradas
 */
export function gerarDatasRecorrentes(config: ConfigRecorrencia): Date[] {
  const datas: Date[] = [];
  let dataAtual = new Date(config.dataInicial);
  let contador = 0;

  // Limite de segurança para evitar loops infinitos
  const LIMITE_MAXIMO = 1000;

  // Extrair hora e minuto da string hora_inicio
  const [hora, minuto] = config.horaInicio.split(":").map(Number);

  // Garantir que a data inicial tem o horário correto
  dataAtual.setHours(hora, minuto, 0, 0);

  while (contador < LIMITE_MAXIMO) {
    // Adicionar data atual à lista
    datas.push(new Date(dataAtual));
    contador++;

    // Verificar condição de parada
    if (
      config.fimTipo === "ocorrencias" &&
      contador >= (config.numOcorrencias || 1)
    ) {
      break;
    }

    // Calcular próxima data baseado no tipo de recorrência
    switch (config.tipo) {
      case "diaria":
        dataAtual = addDays(dataAtual, config.intervalo);
        break;

      case "semanal":
        if (config.diasSemana && config.diasSemana.length > 0) {
          // Recorrência semanal personalizada (dias específicos da semana)
          dataAtual = proximoDiaSemana(dataAtual, config.diasSemana);
        } else {
          // Recorrência semanal simples (mesmo dia da semana)
          dataAtual = addWeeks(dataAtual, config.intervalo);
        }
        break;

      case "mensal":
        dataAtual = addMonths(dataAtual, config.intervalo);
        break;

      case "anual":
        dataAtual = addYears(dataAtual, config.intervalo);
        break;
    }

    // Garantir que mantém o horário correto
    dataAtual.setHours(hora, minuto, 0, 0);

    // Verificar se ultrapassou data fim
    if (config.fimTipo === "ate_data" && config.dataFim) {
      if (dataAtual > config.dataFim) {
        break;
      }
    }
  }

  return datas;
}

/**
 * Encontra o próximo dia da semana baseado em lista de dias permitidos
 * @param dataAtual Data atual
 * @param diasPermitidos Array de dias da semana permitidos (0=Dom, 1=Seg, ..., 6=Sab)
 * @returns Próxima data que cai em um dos dias permitidos
 */
function proximoDiaSemana(dataAtual: Date, diasPermitidos: number[]): Date {
  let proximaData = addDays(dataAtual, 1);
  let tentativas = 0;

  while (tentativas < 7) {
    const diaSemana = proximaData.getDay();
    if (diasPermitidos.includes(diaSemana)) {
      return proximaData;
    }
    proximaData = addDays(proximaData, 1);
    tentativas++;
  }

  // Fallback: se não encontrou, retorna próxima semana mesmo dia
  return addWeeks(dataAtual, 1);
}

/**
 * Formata descrição de recorrência para exibir ao usuário
 * @param config Configuração de recorrência
 * @returns String descritiva da recorrência
 */
export function formatarDescricaoRecorrencia(
  config: ConfigRecorrencia,
): string {
  const { tipo, intervalo, fimTipo, numOcorrencias, dataFim } = config;

  let descricao = "";

  // Tipo de recorrência
  switch (tipo) {
    case "diaria":
      descricao =
        intervalo === 1 ? "Todos os dias" : `A cada ${intervalo} dias`;
      break;
    case "semanal":
      if (config.diasSemana && config.diasSemana.length > 0) {
        const nomesDias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const diasTexto = config.diasSemana.map((d) => nomesDias[d]).join(", ");
        descricao = `Toda semana: ${diasTexto}`;
      } else {
        descricao =
          intervalo === 1 ? "Toda semana" : `A cada ${intervalo} semanas`;
      }
      break;
    case "mensal":
      descricao = intervalo === 1 ? "Todo mês" : `A cada ${intervalo} meses`;
      break;
    case "anual":
      descricao = intervalo === 1 ? "Todo ano" : `A cada ${intervalo} anos`;
      break;
  }

  // Fim da recorrência
  if (fimTipo === "ocorrencias") {
    descricao += ` • ${numOcorrencias} ${numOcorrencias === 1 ? "vez" : "vezes"}`;
  } else if (fimTipo === "ate_data" && dataFim) {
    const dataFormatada = dataFim.toLocaleDateString("pt-BR");
    descricao += ` • Até ${dataFormatada}`;
  }

  return descricao;
}
