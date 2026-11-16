import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { mensagemDeErro } from '../login/login';
import { ConfiguracoesService, Parametros as ParametrosDoSistema } from './configuracoes.service';

/** "0, 3, 7" → [0, 3, 7]; null se algum item não for inteiro não negativo. */
export function lerDias(texto: string): number[] | null {
  const partes = texto
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const numeros = partes.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  return numeros.some((n) => Number.isNaN(n)) ? null : numeros;
}

@Component({
  selector: 'app-parametros',
  imports: [ReactiveFormsModule],
  templateUrl: './parametros.html',
})
export class Parametros implements OnInit {
  private readonly api = inject(ConfiguracoesService);
  private readonly fb = inject(FormBuilder);

  protected readonly carregando = signal(true);
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    especies: [''],
    suspensao: ['15'],
    cancelamento: [''],
    avisos: ['0, 3, 7'],
    desconto: ['0'],
  });

  ngOnInit(): void {
    this.api.parametros().subscribe({
      next: (p) => {
        this.preencher(p);
        this.carregando.set(false);
      },
      error: (e: unknown) => {
        this.carregando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  protected salvar(): void {
    this.aviso.set(null);
    const v = this.form.getRawValue();
    const especies = v.especies
      .split(/[,;\n]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    const avisos = lerDias(v.avisos);
    const suspensao = Number.parseInt(v.suspensao, 10);
    const cancelamento = v.cancelamento.trim() ? Number.parseInt(v.cancelamento, 10) : null;
    const desconto = Number(v.desconto.replace(',', '.'));

    if (!especies.length) {
      return this.recusar('Informe ao menos uma espécie aceita, separadas por vírgula.');
    }
    if (avisos == null) {
      return this.recusar('Os dias de aviso devem ser números separados por vírgula, por exemplo 0, 3, 7.');
    }
    if (!Number.isInteger(suspensao) || suspensao < 1) {
      return this.recusar('Informe em quantos dias de atraso o plano é suspenso (mínimo 1).');
    }
    if (cancelamento != null && (!Number.isInteger(cancelamento) || cancelamento <= suspensao)) {
      return this.recusar('O cancelamento automático deve vir depois da suspensão, ou ficar em branco.');
    }
    if (!Number.isFinite(desconto) || desconto < 0 || desconto >= 100) {
      return this.recusar('O desconto do segundo animal deve ficar entre 0 e menos de 100.');
    }

    this.erro.set(null);
    this.salvando.set(true);
    this.api
      .salvarParametros({
        especiesAceitas: especies,
        atrasoDiasSuspensao: suspensao,
        atrasoDiasCancelamento: cancelamento,
        atrasoDiasAvisos: avisos,
        descontoSegundoAnimalPercentual: desconto,
      })
      .subscribe({
        next: (p) => {
          this.salvando.set(false);
          this.preencher(p);
          this.aviso.set('Parâmetros salvos. Cada alteração fica registrada na auditoria.');
        },
        error: (e: unknown) => {
          this.salvando.set(false);
          this.erro.set(mensagemDeErro(e));
        },
      });
  }

  private recusar(mensagem: string): void {
    this.erro.set(mensagem);
  }

  private preencher(p: ParametrosDoSistema): void {
    this.form.reset({
      especies: p.especiesAceitas.join(', '),
      suspensao: String(p.atrasoDiasSuspensao),
      cancelamento: p.atrasoDiasCancelamento != null ? String(p.atrasoDiasCancelamento) : '',
      avisos: p.atrasoDiasAvisos.join(', '),
      desconto: String(p.descontoSegundoAnimalPercentual).replace('.', ','),
    });
  }
}
