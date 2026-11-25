import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icone } from '../../shared/icone';
import { mensagemDeErro } from '../login/login';
import { ConfiguracoesService, Plano, Previa, Procedimento } from './configuracoes.service';

/**
 * Importação da cobertura por planilha (CSV). Atalho para quem prefere Excel: primeiro mostra o que mudaria, linha a
 * linha; só grava se não houver nenhum erro. A edição do dia a dia é na tela "Planos e coberturas".
 */
@Component({
  selector: 'app-cobertura',
  imports: [RouterLink, Icone],
  templateUrl: './cobertura.html',
})
export class Cobertura implements OnInit {
  private readonly api = inject(ConfiguracoesService);

  protected readonly planos = signal<Plano[]>([]);
  protected readonly procedimentos = signal<Procedimento[]>([]);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly salvando = signal(false);

  protected readonly csv = signal<string | null>(null);
  protected readonly nomeDoArquivo = signal<string | null>(null);
  protected readonly previa = signal<Previa | null>(null);
  protected readonly vigenciaDaImportacao = signal('');

  ngOnInit(): void {
    this.api.planos().subscribe({ next: (l) => this.planos.set(l), error: (e: unknown) => this.erro.set(mensagemDeErro(e)) });
    this.api.procedimentos().subscribe({ next: (l) => this.procedimentos.set(l), error: (e: unknown) => this.erro.set(mensagemDeErro(e)) });
  }

  protected async escolherArquivo(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const arquivo = entrada.files?.[0];
    if (!arquivo) {
      return;
    }
    this.previa.set(null);
    this.erro.set(null);
    this.aviso.set(null);
    this.nomeDoArquivo.set(arquivo.name);
    this.csv.set(await arquivo.text());
  }

  protected baixarModelo(): void {
    const linhas = ['plano;procedimento;carencia_dias;limite_anual;coparticipacao_reais;intervalo_minimo_dias;observacao'];
    const planos = this.planos().filter((p) => p.ativo);
    const procs = this.procedimentos().filter((p) => p.ativo);
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
        this.csv.set(null);
        this.nomeDoArquivo.set(null);
        this.previa.set(null);
        this.vigenciaDaImportacao.set('');
        this.aviso.set(`Planilha aplicada: ${p.novas} regras novas e ${p.alteradas} alteradas. ${p.iguais} já estavam iguais.`);
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
}
