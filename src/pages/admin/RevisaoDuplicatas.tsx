import { useDuplicatasSuspeitas } from "../../hooks/useDuplicatasSuspeitas";
import { useState } from "react";

export default function RevisaoDuplicatas() {
  const { data, isLoading, error } = useDuplicatasSuspeitas();
  const [selecionada, setSelecionada] = useState(null);

  if (isLoading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error.message}</div>;

  return (
    <div>
      <h2>Suspeitas de Duplicidade</h2>
      <ul>
        {data?.map((item) => (
          <li key={item.id}>
            <button onClick={() => setSelecionada(item)}>
              {item.pessoa_id_1.nome} x {item.pessoa_id_2.nome} (score:{" "}
              {item.score_similaridade.toFixed(2)})
            </button>
          </li>
        ))}
      </ul>
      {selecionada && (
        <div style={{ marginTop: 24 }}>
          <h3>Comparação</h3>
          <table>
            <thead>
              <tr>
                <th>Campo</th>
                <th>Pessoa 1</th>
                <th>Pessoa 2</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(selecionada.campos_conflitantes).map(
                ([campo, valores]) => (
                  <tr key={campo}>
                    <td>{campo}</td>
                    <td>{valores[0]}</td>
                    <td>{valores[1]}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
          {/* Botões de ação: Aprovar, Descartar, Mesclar */}
          <button style={{ marginRight: 8 }}>Aprovar Duplicidade</button>
          <button style={{ marginRight: 8 }}>Descartar</button>
          <button>Mesclar</button>
        </div>
      )}
    </div>
  );
}
