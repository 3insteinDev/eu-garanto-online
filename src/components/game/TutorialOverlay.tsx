import { useState } from 'react';
import { Button } from '@/components/ui/button';

const TUTORIAL_KEY = 'eu_garanto_tutorial_done';

const slides = [
  {
    title: 'Objetivo do Jogo',
    icon: '🎯',
    content:
      'Em "Eu Garanto", o objetivo é acertar exatamente quantas vazas você vai ganhar em cada rodada. Quem acerta ganha pontos — quem erra não ganha nada!',
  },
  {
    title: 'Como Jogar Cartas',
    icon: '🃏',
    content:
      'Cada rodada, você recebe cartas e deve seguir o naipe da primeira carta jogada. Se não tiver o naipe, pode jogar qualquer carta — incluindo trunfo! A carta mais forte vence a vaza.',
  },
  {
    title: 'A Aposta',
    icon: '✋',
    content:
      'Antes de jogar, cada jogador aposta quantas vazas pretende ganhar. Atenção: o último a apostar (dealer) não pode fazer com que a soma total seja igual ao número de cartas — alguém sempre terá que errar!',
  },
  {
    title: 'Como Vencer',
    icon: '🏆',
    content:
      'Acertou sua aposta? Ganha 10 pontos + o valor apostado. Errou? Zero pontos. Ao final de todas as rodadas, quem tiver mais pontos vence a partida!',
  },
];

export function TutorialOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);

  const handleFinish = () => {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    onClose();
  };

  const slide = slides[step];
  const isLast = step === slides.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 space-y-5 shadow-2xl">
        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <div className="text-center text-5xl">{slide.icon}</div>
        <h2 className="text-3xl text-primary text-center">{slide.title}</h2>
        <p className="text-sm text-secondary-foreground leading-relaxed text-center">
          {slide.content}
        </p>

        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)} className="flex-1">
              ← Voltar
            </Button>
          )}
          {isLast ? (
            <Button onClick={handleFinish} className="flex-1">
              Começar a Jogar! 🎉
            </Button>
          ) : (
            <Button onClick={() => setStep(step + 1)} className="flex-1">
              Próximo →
            </Button>
          )}
        </div>

        <button
          onClick={handleFinish}
          className="block mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Pular tutorial
        </button>
      </div>
    </div>
  );
}

export function shouldShowTutorial(): boolean {
  return !localStorage.getItem(TUTORIAL_KEY);
}
