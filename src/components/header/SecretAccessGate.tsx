import { type FC, Fragment } from "react";
import { Lock } from "lucide-react";

interface SecretAccessGateProps {
  isMatrixActive: boolean;
  showAccessInput: boolean;
  accessKey: string;
  setAccessKey: (val: string) => void;
  verifyAccessKey: () => void;
  setShowAccessInput: (val: boolean) => void;
}

export const SecretAccessGate: FC<SecretAccessGateProps> = ({
  isMatrixActive,
  showAccessInput,
  accessKey,
  setAccessKey,
  verifyAccessKey,
  setShowAccessInput,
}) => {
  if (!isMatrixActive && !showAccessInput) return null;

  return (
    <Fragment>
      {/* Matrix Entry Animation Overlay */}
      {isMatrixActive && (
        <div
          className="fixed inset-0 z-[200] bg-black flex items-center justify-center overflow-hidden font-mono"
          dir="ltr"
        >
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
          <div className="relative text-center space-y-8 p-4">
            <div className="flex justify-center gap-1">
              {"Welcome to the real world".split("").map((char, i) => (
                <span
                  key={i}
                  className="text-red-600 text-xl sm:text-4xl font-bold animate-pulse inline-block"
                  style={{
                    animationDelay: `${i * 0.15}s`,
                    opacity: 0,
                    animation: `matrix-fade-in 0.5s forwards ${i * 0.15}s, pulse 2s infinite ${i * 0.15 + 2}s`,
                  }}
                >
                  {char === " " ? "\u00A0" : char}
                </span>
              ))}
            </div>
            <div className="h-1 w-0 bg-red-600 mx-auto animate-matrix-line" />
          </div>
          <style jsx global>{`
            @keyframes matrix-fade-in {
              from {
                opacity: 0;
                transform: translateY(10px);
                filter: blur(10px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
                filter: blur(0);
              }
            }
            @keyframes matrix-line {
              0% {
                width: 0;
                opacity: 0;
              }
              50% {
                width: 100%;
                opacity: 1;
              }
              100% {
                width: 80%;
                opacity: 0.5;
              }
            }
            .animate-matrix-line {
              animation: matrix-line 3s ease-in-out forwards 1s;
            }
          `}</style>
        </div>
      )}

      {/* Access Key Input Dialog */}
      {showAccessInput && (
        <div className="absolute top-16 start-0 bg-white dark:bg-brand-navy border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-2xl z-[100] w-64 animate-in fade-in slide-in-from-top-4 duration-300">
          <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest text-start">
            System Authentication
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder="Input key"
              className="bg-slate-100 dark:bg-white/5 border-none rounded-lg px-3 py-2 text-sm w-full focus:ring-1 focus:ring-red-500 transition-all outline-none text-start"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && verifyAccessKey()}
            />
            <button
              onClick={verifyAccessKey}
              className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
              type="button"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowAccessInput(false)}
            className="mt-2 text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 w-full text-center underline"
            type="button"
          >
            Close
          </button>
        </div>
      )}
    </Fragment>
  );
};
