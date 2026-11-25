import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReaisPipe } from '../../shared/dinheiro';
import { Barras } from '../../shared/barras';
import { Numero } from '../../shared/numero';
import { classeDaSituacao } from '../contratos/contratos.service';
import { mensagemDeErro } from '../login/login';
import { Painel, PainelService } from './painel.service';

type PeriodoDasVendas = 'dia' | 'mes';

/** Painel da gestão: o negócio em números, dois gráficos de seis meses e o que pede atenção. */
@Component({
  selector: 'app-painel',
  imports: [RouterLink, DatePipe, ReaisPipe, Numero, Barras],
  templateUrl: './painel.html',
  styleUrl: './painel.scss',
})
export class PainelDaGestao implements OnInit {
  private readonly api = inject(PainelService);

  protected readonly painel = signal<Painel | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  protected readonly classeSituacao = classeDaSituacao;

  /** Vendas por dia (30 dias) ou por mês (6 meses). */
  protected readonly periodoDasVendas = signal<PeriodoDasVendas>('dia');
  protected readonly barrasDeVendas = computed(() => {
    const v = this.painel()?.vendas;
    const lista = this.periodoDasVendas() === 'dia' ? (v?.porDia ?? []) : (v?.porMes ?? []);
    return lista.map((p) => ({ rotulo: p.rotulo, valor: p.valorCentavos }));
  });
  protected readonly maiorVendedor = computed(() => Math.max(1, ...(this.painel()?.vendas?.porPessoaNoMes ?? []).map((p) => p.valorCentavos)));

  protected readonly totalDeContratos = computed(() => (this.painel()?.contratosPorSituacao ?? []).reduce((s, f) => s + f.valor, 0));
  protected readonly comContratos = computed(() => (this.painel()?.contratosPorSituacao ?? []).filter((f) => f.valor > 0));
  protected readonly semContratos = computed(() =>
    (this.painel()?.contratosPorSituacao ?? [])
      .filter((f) => f.valor === 0)
      .map((f) => f.rotulo.toLowerCase())
      .join(', '),
  );
  protected readonly maisUsado = computed(() => Math.max(1, ...(this.painel()?.procedimentosMaisUsados ?? []).map((f) => f.valor)));

  ngOnInit(): void {
    this.carregar();
  }

  protected carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);
    this.api.consultar().subscribe({
      next: (p) => {
        this.painel.set(p);
        this.carregando.set(false);
      },
      error: (e: unknown) => {
        this.carregando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  protected porcentagem(valor: number, total: number): number {
    return total ? Math.round((valor / total) * 100) : 0;
  }
}
