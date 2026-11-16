import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { emailValido, idadeEmTexto, mascaraTelefone, rotuloDaEspecie, telefoneValido } from '../../shared/documentos';
import { ConfiguracoesService } from '../configuracoes/configuracoes.service';
import { mensagemDeErro } from '../login/login';
import { AnimalForm } from './animal-form';
import { Animal, DadosDoAnimal, Tutor as TutorDto, TutoresService } from './tutores.service';

const telefone = (c: AbstractControl): ValidationErrors | null => (telefoneValido(c.value) ? null : { telefone: true });
const email = (c: AbstractControl): ValidationErrors | null => (emailValido(c.value) ? null : { email: true });
const nomeCompleto = (c: AbstractControl): ValidationErrors | null =>
  String(c.value ?? '').trim().split(/\s+/).length >= 2 ? null : { nome: true };

@Component({
  selector: 'app-tutor',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, AnimalForm],
  templateUrl: './tutor.html',
})
export class Tutor implements OnInit {
  private readonly api = inject(TutoresService);
  private readonly config = inject(ConfiguracoesService);
  private readonly fb = inject(FormBuilder);
  private readonly rota = inject(ActivatedRoute);

  protected readonly tutor = signal<TutorDto | null>(null);
  protected readonly especies = signal<string[]>([]);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly salvando = signal(false);
  protected readonly editandoTutor = signal(false);
  /** null = fechado; 'novo' = cadastro; senão, o id do animal em edição. */
  protected readonly editandoAnimal = signal<string | 'novo' | null>(null);
  protected readonly animalEmEdicao = signal<Animal | null>(null);
  protected readonly carregando = signal(true);

  protected readonly rotuloEspecie = rotuloDaEspecie;
  protected readonly formatarTelefone = mascaraTelefone;
  protected readonly idade = (a: Animal): string => idadeEmTexto(a.nascimento);

  protected readonly formTutor = this.fb.nonNullable.group({
    nome: ['', [Validators.required, nomeCompleto]],
    telefone: ['', [Validators.required, telefone]],
    email: ['', [email]],
  });

  private id = '';

  ngOnInit(): void {
    this.id = this.rota.snapshot.paramMap.get('id') ?? '';
    if (this.rota.snapshot.queryParamMap.get('novo')) {
      this.aviso.set('Tutor cadastrado. Agora cadastre os animais dele.');
    }
    this.config.parametros().subscribe({ next: (p) => this.especies.set(p.especiesAceitas) });
    this.carregar(() => {
      if (!this.tutor()?.animais.length) {
        this.novoAnimal(true);
      }
    });
  }

  // ----- tutor -----

  protected editarTutor(): void {
    const t = this.tutor()!;
    this.aviso.set(null);
    this.erro.set(null);
    this.formTutor.reset({ nome: t.nome, telefone: mascaraTelefone(t.telefone), email: t.email ?? '' });
    this.editandoTutor.set(true);
  }

  protected mascararTelefone(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const valor = mascaraTelefone(entrada.value);
    this.formTutor.controls.telefone.setValue(valor);
    entrada.value = valor;
  }

  protected salvarTutor(): void {
    if (this.formTutor.invalid) {
      this.formTutor.markAllAsTouched();
      return;
    }
    this.erro.set(null);
    this.salvando.set(true);
    this.api.alterar(this.id, this.formTutor.getRawValue()).subscribe({
      next: () => {
        this.salvando.set(false);
        this.editandoTutor.set(false);
        this.aviso.set('Dados do tutor atualizados.');
        this.carregar();
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  // ----- animais -----

  protected novoAnimal(manterAviso = false): void {
    if (!manterAviso) {
      this.aviso.set(null);
    }
    this.erro.set(null);
    this.animalEmEdicao.set(null);
    this.editandoAnimal.set('novo');
  }

  protected editarAnimal(a: Animal): void {
    this.aviso.set(null);
    this.erro.set(null);
    this.animalEmEdicao.set(a);
    this.editandoAnimal.set(a.id);
  }

  protected cancelarAnimal(): void {
    this.editandoAnimal.set(null);
    this.animalEmEdicao.set(null);
  }

  protected salvarAnimal(dados: DadosDoAnimal): void {
    this.erro.set(null);
    this.salvando.set(true);
    const alvo = this.editandoAnimal();
    const chamada = alvo === 'novo' ? this.api.cadastrarAnimal(this.id, dados) : this.api.alterarAnimal(alvo as string, dados);
    chamada.subscribe({
      next: (a) => {
        this.salvando.set(false);
        this.cancelarAnimal();
        this.aviso.set(alvo === 'novo' ? `${a.nome} cadastrado.` : `Dados de ${a.nome} atualizados.`);
        this.carregar();
      },
      error: (e: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }

  protected alternarAnimal(a: Animal): void {
    this.erro.set(null);
    this.aviso.set(null);
    this.api.situacaoDoAnimal(a.id, !a.ativo).subscribe({
      next: () => this.carregar(),
      error: (e: unknown) => this.erro.set(mensagemDeErro(e)),
    });
  }

  private carregar(depois?: () => void): void {
    this.api.consultar(this.id).subscribe({
      next: (t) => {
        this.tutor.set(t);
        this.carregando.set(false);
        depois?.();
      },
      error: (e: unknown) => {
        this.carregando.set(false);
        this.erro.set(mensagemDeErro(e));
      },
    });
  }
}
