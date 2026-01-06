import { useState } from "react";
import { motion } from "framer-motion";
import {
  IconX,
  IconLoader2,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
} from "@tabler/icons-react";

interface SuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, body: string) => Promise<void>;
}

type IssueType = "feat" | "fix" | "docs" | "refactor" | "perf";

const ISSUE_TYPES: { value: IssueType; label: string; description: string }[] =
  [
    { value: "feat", label: "Feature", description: "Nova funcionalidade" },
    { value: "fix", label: "Bug Fix", description: "Correção de bug" },
    { value: "docs", label: "Docs", description: "Documentação" },
    {
      value: "refactor",
      label: "Refactor",
      description: "Refatoração de código",
    },
    {
      value: "perf",
      label: "Performance",
      description: "Melhoria de performance",
    },
  ];

const SCOPES = [
  "core",
  "ui",
  "system",
  "download",
  "converter",
  "settings",
  "auth",
  "roadmap",
];

export default function SuggestionModal({
  isOpen,
  onClose,
  onSubmit,
}: SuggestionModalProps) {
  // Form state
  const [issueType, setIssueType] = useState<IssueType>("feat");
  const [scope, setScope] = useState("core");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [problem, setProblem] = useState("");
  const [proposal, setProposal] = useState("");
  const [tasks, setTasks] = useState("");
  const [references, setReferences] = useState("");
  const [dependencies, setDependencies] = useState("");

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const resetForm = () => {
    setIssueType("feat");
    setScope("core");
    setTitle("");
    setContext("");
    setProblem("");
    setProposal("");
    setTasks("");
    setReferences("");
    setDependencies("");
    setShowAdvanced(false);
  };

  const handleClose = () => {
    resetForm();
    setSubmitSuccess(false);
    onClose();
  };

  const generateMarkdown = (): string => {
    const sections: string[] = [];

    // Contexto
    if (context.trim()) {
      sections.push(`## Contexto\n\n${context.trim()}`);
    }

    // Problema / Motivação
    if (problem.trim()) {
      const header = issueType === "fix" ? "## Problema Atual" : "## Motivação";
      sections.push(`${header}\n\n${problem.trim()}`);
    }

    // Proposta Técnica
    if (proposal.trim()) {
      sections.push(`## Proposta Técnica\n\n${proposal.trim()}`);
    }

    // Tarefas
    if (tasks.trim()) {
      const taskLines = tasks
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => `- [ ] ${line.trim()}`)
        .join("\n");
      sections.push(`## Tarefas\n\n${taskLines}`);
    }

    // Dependências (opcional)
    if (dependencies.trim()) {
      sections.push(`## Dependência\n\n> ⚠️ ${dependencies.trim()}`);
    }

    // Referências (opcional)
    if (references.trim()) {
      const refLines = references
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => `- ${line.trim()}`)
        .join("\n");
      sections.push(`## Referências\n\n${refLines}`);
    }

    return sections.join("\n\n");
  };

  const generateTitle = (): string => {
    return `${issueType}(${scope}): ${title.trim()}`;
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const fullTitle = generateTitle();
      const body = generateMarkdown();
      await onSubmit(fullTitle, body);
      setSubmitSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      console.error("Failed to submit suggestion:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-[2px]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-2xl bg-white dark:bg-surface-950 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-800 overflow-hidden relative max-h-[90vh] flex flex-col"
      >
        {/* Gradient bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 via-amber-500 to-purple-500" />

        {submitSuccess ? (
          <div className="p-10 text-center">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <IconCheck size={32} stroke={3} />
            </div>
            <h3 className="text-lg font-bold text-surface-900 dark:text-white">
              Sugestão Enviada
            </h3>
            <p className="text-sm text-surface-500 mt-2">
              Issue criada com sucesso no GitHub.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-5 flex justify-between items-center border-b border-surface-100 dark:border-surface-800 shrink-0">
              <h3 className="font-bold text-surface-900 dark:text-white">
                Nova Sugestão
              </h3>
              <button
                onClick={handleClose}
                className="text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors"
              >
                <IconX size={20} />
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {/* Row: Type + Scope + Title */}
              <div className="grid grid-cols-12 gap-3">
                {/* Type */}
                <div className="col-span-3 space-y-1.5">
                  <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                    Tipo
                  </label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value as IssueType)}
                    className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none appearance-none cursor-pointer"
                  >
                    {ISSUE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scope */}
                <div className="col-span-3 space-y-1.5">
                  <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                    Escopo
                  </label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none appearance-none cursor-pointer"
                  >
                    {SCOPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Title */}
                <div className="col-span-6 space-y-1.5">
                  <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                    Título
                  </label>
                  <input
                    type="text"
                    placeholder="Breve descrição da mudança"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none"
                  />
                </div>
              </div>

              {/* Preview do título */}
              {title && (
                <div className="text-xs text-surface-400 font-mono bg-surface-50 dark:bg-surface-900 px-3 py-2 rounded-lg">
                  {generateTitle()}
                </div>
              )}

              {/* Contexto */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                  Contexto
                </label>
                <textarea
                  placeholder="Descreva o cenário atual e por que essa mudança é relevante..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none h-20 resize-none"
                />
              </div>

              {/* Problema / Motivação */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                  {issueType === "fix" ? "Problema Atual" : "Motivação"}
                </label>
                <textarea
                  placeholder={
                    issueType === "fix"
                      ? "Descreva o bug ou comportamento incorreto..."
                      : "Por que essa feature é importante? Qual problema resolve?"
                  }
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none h-20 resize-none"
                />
              </div>

              {/* Proposta Técnica */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                  Proposta Técnica
                </label>
                <textarea
                  placeholder="Como você sugere implementar? Quais componentes/arquivos serão afetados?"
                  value={proposal}
                  onChange={(e) => setProposal(e.target.value)}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none h-20 resize-none"
                />
              </div>

              {/* Tarefas */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                  Tarefas{" "}
                  <span className="text-surface-400 font-normal">
                    (uma por linha)
                  </span>
                </label>
                <textarea
                  placeholder="Implementar X&#10;Testar Y&#10;Atualizar documentação"
                  value={tasks}
                  onChange={(e) => setTasks(e.target.value)}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none h-20 resize-none font-mono text-xs"
                />
              </div>

              {/* Advanced Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
              >
                <IconChevronDown
                  size={14}
                  className={`transform transition-transform ${
                    showAdvanced ? "rotate-180" : ""
                  }`}
                />
                Campos avançados
              </button>

              {/* Advanced Fields */}
              {showAdvanced && (
                <div className="space-y-4 pt-2">
                  {/* Dependências */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                      Dependências{" "}
                      <span className="text-surface-400 font-normal">
                        (opcional)
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Requer migração para Wails v3"
                      value={dependencies}
                      onChange={(e) => setDependencies(e.target.value)}
                      className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none"
                    />
                  </div>

                  {/* Referências */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                      Referências{" "}
                      <span className="text-surface-400 font-normal">
                        (uma por linha)
                      </span>
                    </label>
                    <textarea
                      placeholder="Link para documentação&#10;Arquivo relevante: app.go:150"
                      value={references}
                      onChange={(e) => setReferences(e.target.value)}
                      className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg px-3 py-2.5 text-sm focus:border-primary-500 outline-none h-16 resize-none font-mono text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-surface-100 dark:border-surface-800 flex justify-end gap-3 shrink-0 bg-surface-50/50 dark:bg-surface-900/50">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || isSubmitting}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-surface-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2"
              >
                {isSubmitting ? (
                  <IconLoader2 className="animate-spin" size={16} />
                ) : (
                  <IconArrowRight size={16} />
                )}
                Criar Issue
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
