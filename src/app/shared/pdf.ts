import { Observable } from 'rxjs';
import { mensagemDeErro } from '../pages/login/login';

/** Baixa o PDF autenticado e abre numa aba nova. */
export function abrirPdf(pdf$: Observable<Blob>, aoFalhar: (mensagem: string) => void): void {
  // A aba é aberta no clique, antes da resposta, para o navegador não bloquear como pop-up.
  const aba = window.open('', '_blank');
  pdf$.subscribe({
    next: (blob) => {
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      if (aba) {
        aba.location.href = url;
      } else {
        window.open(url, '_blank');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    error: (e: unknown) => {
      aba?.close();
      aoFalhar(mensagemDeErro(e));
    },
  });
}
