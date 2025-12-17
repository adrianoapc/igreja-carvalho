import jsPDF from 'jspdf';

interface CertificadoParams {
  nomeAluno: string;
  nomeJornada: string;
  dataConclusao: Date;
  nomeIgreja?: string;
}

export const gerarCertificado = ({
  nomeAluno,
  nomeJornada,
  dataConclusao,
  nomeIgreja = 'Igreja Carvalho'
}: CertificadoParams) => {
  // Criar documento PDF em orientação paisagem (landscape)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Cores
  const primaryBlue = '#3b82f6';
  const goldAccent = '#f59e0b';

  // Borda decorativa externa (azul)
  doc.setDrawColor(59, 130, 246); // RGB do primaryBlue
  doc.setLineWidth(2);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // Borda decorativa interna (dourada)
  doc.setDrawColor(245, 158, 11); // RGB do goldAccent
  doc.setLineWidth(1);
  doc.rect(15, 15, pageWidth - 30, pageHeight - 30);

  // Logo e nome da igreja (topo)
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text(nomeIgreja, pageWidth / 2, 30, { align: 'center' });

  // Título "CERTIFICADO" (grande e centralizado)
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246); // primaryBlue
  doc.text('CERTIFICADO', pageWidth / 2, 55, { align: 'center' });

  // Subtítulo "Certificamos que"
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Certificamos que', pageWidth / 2, 70, { align: 'center' });

  // Nome do aluno (destaque em azul e negrito)
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246); // primaryBlue
  doc.text(nomeAluno, pageWidth / 2, 85, { align: 'center' });

  // Texto "concluiu com êxito a jornada"
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('concluiu com êxito a jornada', pageWidth / 2, 100, { align: 'center' });

  // Nome da jornada (destaque em azul e negrito)
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246); // primaryBlue
  doc.text(nomeJornada, pageWidth / 2, 115, { align: 'center' });

  // Data de conclusão
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const dataFormatada = dataConclusao.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  doc.text(`Concluído em ${dataFormatada}`, pageWidth / 2, 135, { align: 'center' });

  // Linha de assinatura (decorativa)
  const signatureY = 160;
  const signatureWidth = 80;
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.5);
  doc.line(
    pageWidth / 2 - signatureWidth / 2,
    signatureY,
    pageWidth / 2 + signatureWidth / 2,
    signatureY
  );

  // Texto "Assinatura do Responsável"
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text('Assinatura do Responsável', pageWidth / 2, signatureY + 7, {
    align: 'center'
  });

  // Rodapé com nome da igreja e data de emissão
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `${nomeIgreja} - Emitido em ${new Date().toLocaleDateString('pt-BR')}`,
    pageWidth / 2,
    pageHeight - 15,
    { align: 'center' }
  );

  // Gerar nome do arquivo seguro (sanitizar caracteres especiais)
  const nomeArquivo = `Certificado_${nomeAluno.replace(/[^a-zA-Z0-9]/g, '_')}_${nomeJornada.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

  // Baixar o PDF
  doc.save(nomeArquivo);
};
