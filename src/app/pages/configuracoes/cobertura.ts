import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { centavosParaCampo, ReaisPipe, reaisParaCentavos } from '../../shared/dinheiro';
import { Icone } from '../../shared/icone';
import { mensagemDeErro } from '../login/login';
import { ConfiguracoesService, ItemDeCobertura, Plano, Previa, Regra } from './configuracoes.service';

@Component({
  selector: 'app-cobertura',
  imports: [ReactiveFormsModule, ReaisPipe, DatePipe, Icone],
  templateUrl: './cobertura.html',
})
export class Cobertura implements OnInit {
  private readonly api = inject(ConfiguracoesService);
  private readonly fb = inject(FormBuilder);

  protected readonly planos = signal<Plano[]>([]);
  protected readonly planoId = signal<string | null>(null);
  protected readonly itens = signal<ItemDeCobertura[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly salvando = signal(false);

  protected readonly plano = computed(() => this.planos().find((p) => p.id === this.planoId()) ?? null);
  protected readonly cobertos = computed(() => this.itens().filter((i) => i.regra).length);

  /** Procedimento cuja regra está sendo editada na própria linha da tabela. */
  protected readonly editando = signal<string | null>(null);
  protected readonly historico = signal<{ nome: string; versoes: Regra[] } | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    carencia: ['0'],
    limite: ['0'],
    copart: ['0,00'],
    intervalo: [''],
    desde: [''],
  });

  // importação
  protected readonly importando = signal(false);
  protected readonly csv = signal<string | null>(null);
  protected readonly nomeDoArquivo = signal<string | null>(null);
  protected readonly previa = signal<Previa | null>(null);
  protected readonly vigenciaDaImportacao = signal('');

  ngOnInit(): void {
    this.api.planos().subscribe({
      next: (lista) => {
        this.planos.set(lista);
        this.carregando.set(false);
        const primeiro = lista.find((p) => p.ativo) ?? lista[0];
        if (primeiro) {
          this.escolher(primeiro.id);
        }
      },
      error: (e: unknown) => {
        this.carregando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  protected escolher(id: string): void {
    this.planoId.set(id);
    this.editando.set(null);
    this.historico.set(null);
    this.carregarCobertura();
  }

  protected abrirEdicao(item: ItemDeCobertura): void {
    const r = item.regra;
    this.aviso.set(null);
    this.erro.set(null);
    this.form.reset({
      carencia: String(r?.carenciaDias ?? 0),
      limite: String(r?.limiteAnual ?? 0),
      copart: centavosParaCampo(r?.coparticipacaoCentavos ?? 0),
      intervalo: r?.intervaloMinimoDias ? String(r.intervaloMinimoDias) : '',
      desde: '',
    });
    this.editando.set(item.procedimento.id);
  }

  protected cancelarEdicao(): void {
    this.editando.set(null);
  }

  protected salvarRegra(item: ItemDeCobertura): void {
    const v = this.form.getRawValue();
    const carencia = Number.parseInt(v.carencia, 10);
    const limite = Number.parseInt(v.limite, 10);
    const copart = reaisParaCentavos(v.copart);
    const intervalo = v.intervalo.trim() ? Number.parseInt(v.intervalo, 10) : null;
    if (!Number.isInteger(carencia) || carencia < 0 || !Number.isInteger(limite) || limite < 0 || copart == null) {
      this.erro.set('Informe carência e limite como números inteiros e a coparticipação em reais, por exemplo 25,00.');
      return;
    }
    if (intervalo != null && (!Number.isInteger(intervalo) || intervalo < 1)) {
      this.erro.set('O intervalo mínimo deve ser de pelo menos 1 dia, ou ficar em branco.');
      return;
    }
    this.erro.set(null);
    this.salvando.set(true);
    this.api
      .definirRegra(this.planoId()!, item.procedimento.id, {
        carenciaDias: carencia,
        limiteAnual: limite,
        coparticipacaoCentavos: copart,
        intervaloMinimoDias: intervalo,
        vigenciaInicio: v.desde || null,
      })
      .subscribe({
        next: (res) => {
          this.salvando.set(false);
          this.editando.set(null);
          this.aviso.set(
            res.alterou
              ? `Regra de ${item.procedimento.nome} atualizada. A versão anterior ficou no histórico.`
              : `Nada mudou na regra de ${item.procedimento.nome}.`,
          );
          this.carregarCobertura();
        },
        error: (e: unknown) => {
          this.salvando.set(false);
          this.erro.set(mensagemDeErro(e));
        },
      });
  }

  protected deixarDeCobrir(item: ItemDeCobertura): void {
    this.erro.set(null);
    this.aviso.set(null);
    this.api.removerRegra(this.planoId()!, item.procedimento.id).subscribe({
      next: () => {
        this.aviso.set(`${item.procedimento.nome} deixa de ser coberto neste plano a partir de hoje.`);
        this.carregarCobertura();
      },
      error: (e: unknown) => this.erro.set(mensagemDeErro(e)),
    });
  }

  protected verHistorico(item: ItemDeCobertura): void {
    this.erro.set(null);
    this.api.historico(this.planoId()!, item.procedimento.id).subscribe({
      next: (versoes) => this.historico.set({ nome: item.procedimento.nome, versoes }),
      error: (e: unknown) => this.erro.set(mensagemDeErro(e)),
    });
  }

  protected fecharHistorico(): void {
    this.historico.set(null);
  }

  // ----- importação -----

  protected abrirImportacao(): void {
    this.importando.set(true);
    this.aviso.set(null);
    this.erro.set(null);
  }

  protected fecharImportacao(): void {
    this.importando.set(false);
    this.csv.set(null);
    this.nomeDoArquivo.set(null);
    this.previa.set(null);
    this.vigenciaDaImportacao.set('');
  }

  protected async escolherArquivo(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const arquivo = entrada.files?.[0];
    if (!arquivo) {
      return;
    }
    this.previa.set(null);
    this.erro.set(null);
    this.nomeDoArquivo.set(arquivo.name);
    this.csv.set(await arquivo.text());
  }

  protected baixarModelo(): void {
    const linhas = ['plano;procedimento;carencia_dias;limite_anual;coparticipacao_reais;intervalo_minimo_dias;observacao'];
    const planos = this.planos().filter((p) => p.ativo);
    const procs = this.itens().map((i) => i.procedimento).filter((p) => p.ativo);
    for (const plano of planos) {
      for (const proc of procs) {
        linhas.push(`${plano.nome};${proc.nome};0;0;0,00;;`);
      }
    }
    const blob = new Blob(['﻿' + linhas.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-cobertura.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  protected gerarPrevia(): void {
    const conteudo = this.csv();
    if (!conteudo) {
      return;
    }
    this.erro.set(null);
    this.salvando.set(true);
    this.api.previaDaImportacao(conteudo).subscribe({
      next: (p) => {
        this.salvando.set(false);
        this.previa.set(p);
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  protected podeAplicar(): boolean {
    const p = this.previa();
    return !!p && p.erros.length === 0 && p.novas + p.alteradas > 0;
  }

  protected aplicar(): void {
    const conteudo = this.csv();
    if (!conteudo || !this.podeAplicar()) {
      return;
    }
    this.erro.set(null);
    this.salvando.set(true);
    this.api.aplicarImportacao(conteudo, this.vigenciaDaImportacao() || null).subscribe({
      next: (p) => {
        this.salvando.set(false);
        this.fecharImportacao();
        this.aviso.set(`Planilha aplicada: ${p.novas} regras novas e ${p.alteradas} alteradas. ${p.iguais} já estavam iguais.`);
        this.carregarCobertura();
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  protected mudarVigencia(evento: Event): void {
    this.vigenciaDaImportacao.set((evento.target as HTMLInputElement).value);
  }

  protected rotuloDaAcao(a: string): string {
    return a === 'NOVA' ? 'Nova' : a === 'ALTERADA' ? 'Alterada' : 'Igual';
  }

  protected resumo(r?: { carenciaDias: number; limiteAnual: number; coparticipacaoCentavos: number }): string {
    if (!r) {
      return '—';
    }
    const copart = (r.coparticipacaoCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    return `${r.carenciaDias} d · ${r.limiteAnual}/ano · ${copart}`;
  }

  private carregarCobertura(): void {
    const id = this.planoId();
    if (!id) {
      return;
    }
    this.api.cobertura(id).subscribe({
      next: (lista) => this.itens.set(lista),
      error: (e: unknown) => this.erro.set(mensagemDeErro(e)),
    });
  }
}
