import { Component, OnInit, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { rotuloDaEspecie } from '../../shared/documentos';
import { Animal, DadosDoAnimal } from './tutores.service';

/** Formulário de animal, usado na ficha do tutor (cadastro e edição) e dentro da contratação. */
@Component({
  selector: 'app-animal-form',
  imports: [ReactiveFormsModule],
  templateUrl: './animal-form.html',
})
export class AnimalForm implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly especies = input.required<string[]>();
  /** Animal em edição; vazio para cadastrar um novo. */
  readonly animal = input<Animal | null>(null);
  readonly salvando = input(false);

  readonly enviar = output<DadosDoAnimal>();
  readonly cancelar = output<void>();

  protected readonly rotuloEspecie = rotuloDaEspecie;
  protected readonly hoje = new Date().toISOString().slice(0, 10);

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required]],
    especie: ['', [Validators.required]],
    raca: [''],
    sexo: [''],
    nascimento: ['', [Validators.required]],
    microchip: ['', [Validators.pattern(/^(\s*|[\d\s.-]{15,20})$/)]],
  });

  ngOnInit(): void {
    const a = this.animal();
    if (a) {
      this.form.reset({
        nome: a.nome,
        especie: a.especie,
        raca: a.raca ?? '',
        sexo: a.sexo ?? '',
        nascimento: a.nascimento,
        microchip: a.microchip ?? '',
      });
    } else if (this.especies().length === 1) {
      this.form.controls.especie.setValue(this.especies()[0]);
    }
  }

  protected salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviar.emit(this.form.getRawValue());
  }
}
