import { describe, expect, it } from 'vitest';
import { formatar, interpretar } from './auditoria-detalhes';

describe('auditoria-detalhes', () => {
  it('formata valores conforme o campo', () => {
    expect(formatar(8990, 'mensalidadeCentavos')).toContain('89,90');
    expect(formatar('2026-11-17', 'data')).toBe('17/11/2026');
    expect(formatar('2026-11', 'competencia')).toBe('11/2026');
    expect(formatar('AGUARDANDO_PAGAMENTO', 'para')).toBe('Aguardando pagamento');
    expect(formatar('GESTAO', 'perfil')).toBe('Gestão');
    expect(formatar(true)).toBe('Sim');
    expect(formatar(null)).toBe('—');
  });

  it('mostra o que foi feito com rótulos legíveis', () => {
    const r = interpretar('ATENDIMENTO_AUTORIZADO', { contrato: 'VP-2026-0003', procedimento: 'Consulta', estado: 'LIBERADO', usosNoPeriodo: 1 });
    expect(r.mudancas).toEqual([]);
    expect(r.dados).toEqual([
      { rotulo: 'Contrato', valor: 'VP-2026-0003' },
      { rotulo: 'Procedimento', valor: 'Consulta' },
      { rotulo: 'Resultado', valor: 'Liberado' },
      { rotulo: 'Usos no período', valor: '1' },
    ]);
  });

  it('separa antes e depois da cobertura em campos que mudaram', () => {
    const r = interpretar('COBERTURA_ALTERADA', {
      plano: 'Essencial',
      procedimento: 'Consulta',
      vigenciaInicio: '2026-11-17',
      antes: { carenciaDias: 30, limiteAnual: 4, coparticipacaoCentavos: 2500 },
      depois: { carenciaDias: 0, limiteAnual: 4, coparticipacaoCentavos: 2500 },
    });
    expect(r.dados.map((d) => d.rotulo)).toEqual(['Plano', 'Procedimento', 'Vale a partir de']);
    expect(r.mudancas[0]).toEqual({ rotulo: 'Carência (dias)', antes: '30', depois: '0', igual: false });
    expect(r.mudancas).toHaveLength(3);
    expect(r.mudancas.slice(1).every((m) => m.igual)).toBe(true);
  });

  it('trata regra nova (antes: não coberto) e remoção', () => {
    const nova = interpretar('COBERTURA_ALTERADA', { antes: 'não coberto', depois: { carenciaDias: 0 } });
    expect(nova.dados).toContainEqual({ rotulo: 'Situação anterior', valor: 'Não coberto' });
    expect(nova.mudancas[0]).toEqual({ rotulo: 'Carência (dias)', antes: '—', depois: '0', igual: false });
    const removida = interpretar('COBERTURA_REMOVIDA', { antes: { limiteAnual: 2 } });
    expect(removida.mudancas[0].depois).toBe('Removido');
  });

  it('junta pares campoAntes/campoDepois e ignora os que não mudaram', () => {
    const r = interpretar('PLANO_ALTERADO', { nomeAntes: 'Essencial', nomeDepois: 'Essencial', mensalidadeAntesCentavos: 8000, mensalidadeDepoisCentavos: 8990 });
    expect(r.mudancas).toHaveLength(1);
    expect(r.mudancas[0].rotulo).toBe('Mensalidade');
    expect(r.mudancas[0].antes).toContain('80,00');
    expect(r.mudancas[0].depois).toContain('89,90');
  });

  it('lê parâmetros com antes e depois', () => {
    const r = interpretar('PARAMETRO_ALTERADO', { dias_de_aviso: { antes: '5', depois: '7' } });
    expect(r.mudancas).toEqual([{ rotulo: 'Dias de aviso', antes: '5', depois: '7', igual: false }]);
  });

  it('aceita registro sem detalhes', () => {
    expect(interpretar('LOGOUT', undefined)).toEqual({ dados: [], mudancas: [] });
  });
});
