import { Component, OnInit, inject, input, output } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { cpfValido, emailValido, mascaraCpf, mascaraTelefone, telefoneValido } from '../../shared/documentos';
import { NovoTutor } from './tutores.service';

export const cpf = (c: AbstractControl): ValidationErrors | null => (cpfValido(c.value) ? null : { cpf: true });
export const telefone = (c: AbstractControl): ValidationErrors | null => (telefoneValido(c.value) ? null : { telefone: true });
export const email = (c: AbstractControl): ValidationErrors | null => (emailValido(c.value) ? null : { email: true });
export const nomeCompleto = (c: AbstractControl): ValidationErrors | null =>
  String(c.value ?? '').trim().split(/\s+/).length >= 2 ? null : { nome: true };

/** Formulário de cadastro de tutor, usado na tela de novo tutor e dentro da contratação. */
@Component({
  selector: 'app-tutor-form',
  imports: [ReactiveFormsModule],
  templateUrl: './tutor-form.html',
})
export class TutorForm implements OnInit {
  private readonly fb = inject(FormBuilder);

  /** CPF já digitado na busca, para não pedir de novo. */
  readonly cpfInicial = input('');
  readonly salvando = input(false);
  readonly rotulo = input('Cadastrar tutor');

  readonly enviar = output<NovoTutor>();
  readonly cancelar = output<void>();

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, nomeCompleto]],
    cpf: ['', [Validators.required, cpf]],
    telefone: ['', [Validators.required, telefone]],
    email: ['', [email]],
    aviso: [false, [Validators.requiredTrue]],
  });

  ngOnInit(): void {
    if (this.cpfInicial()) {
      this.form.controls.cpf.setValue(mascaraCpf(this.cpfInicial()));
    }
  }

  protected mascarar(campo: 'cpf' | 'telefone', evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const valor = campo === 'cpf' ? mascaraCpf(entrada.value) : mascaraTelefone(entrada.value);
    this.form.controls[campo].setValue(valor);
    entrada.value = valor;
  }

  protected salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.enviar.emit({ nome: v.nome, cpf: v.cpf, telefone: v.telefone, email: v.email, avisoDePrivacidadeCiente: v.aviso });
  }
}
