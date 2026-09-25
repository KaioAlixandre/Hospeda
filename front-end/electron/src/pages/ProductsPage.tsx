import {
  FolderOpen,
  Package,
  Pencil,
  Plus,
  Power,
  Search,
  Upload,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { api } from "../api";
import {
  Button,
  EmptyState,
  Feedback,
  Field,
  Icon,
  Loading,
  Modal,
} from "../components/ui";
import {
  brl,
  formatMoneyInput,
  moneyInputMask,
  parseMoneyInput,
  ptError,
} from "../lib/format";
import type { ChargeCategory, ChargeGroup, Product } from "../types";

type ProductsTab = "products" | "categories";

const TABS: Array<{
  id: ProductsTab;
  label: string;
  shortLabel: string;
  icon: ReactNode;
}> = [
  {
    id: "products",
    label: "Produtos",
    shortLabel: "Produtos",
    icon: <Package size={16} />,
  },
  {
    id: "categories",
    label: "Categorias",
    shortLabel: "Categorias",
    icon: <FolderOpen size={16} />,
  },
];

const GROUP_OPTIONS: Array<{
  value: ChargeGroup;
  label: string;
  hint: string;
}> = [
  {
    value: "CONSUMPTION",
    label: "Consumo",
    hint: "soma na conta como consumo (frigobar, restaurante, bar)",
  },
  {
    value: "SERVICE",
    label: "Serviço",
    hint: "soma na conta como serviço (lavanderia, passeio, transfer)",
  },
  {
    value: "DISCOUNT",
    label: "Desconto",
    hint: "abate do total da conta",
  },
];

const ICON_OPTIONS = [
  "wine",
  "utensils",
  "shirt",
  "concierge-bell",
  "receipt",
  "tag",
  "package",
];

function parseImportLines(text: string): Array<{ name: string; price: number }> {
  const rows: Array<{ name: string; price: number }> = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[,\t;]/);
    if (parts.length < 2) continue;
    const priceRaw = parts[parts.length - 1]!.trim();
    const name = parts.slice(0, -1).join(",").trim();
    const price = parseMoneyInput(priceRaw);
    if (!name || !Number.isFinite(price) || price <= 0) continue;
    rows.push({ name, price });
  }
  return rows;
}

export function ProductsPage() {
  const [activeTab, setActiveTab] = useState<ProductsTab>("products");
  const [categories, setCategories] = useState<ChargeCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editingCategory, setEditingCategory] = useState<
    ChargeCategory | "new" | null
  >(null);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");

  const nameInputRef = useRef<HTMLInputElement>(null);
  const [productForm, setProductForm] = useState({
    categoryId: "",
    name: "",
    code: "",
    price: "",
    unit: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [cats, prods] = await Promise.all([
        api.chargeCategories.list(),
        api.products.list(),
      ]);
      setCategories(cats);
      setProducts(prods);
      if (!productForm.categoryId && cats.length > 0) {
        const firstActive = cats.find((c) => c.active) ?? cats[0]!;
        setProductForm((prev) => ({ ...prev, categoryId: firstActive.id }));
      }
    } catch (err) {
      setError(ptError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredProducts = products.filter((p) => {
    if (categoryFilter && p.categoryId !== categoryFilter) return false;
    if (!productSearch.trim()) return true;
    const q = productSearch.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.code?.toLowerCase().includes(q) ?? false)
    );
  });

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCategory) return;
    const form = new FormData(event.currentTarget);
    const body = {
      name: String(form.get("name") || "").trim(),
      group: String(form.get("group") || "SERVICE") as ChargeGroup,
      icon: String(form.get("icon") || "") || null,
    };
    setError(null);
    try {
      if (editingCategory === "new") {
        await api.chargeCategories.create(body);
        setMessage("Categoria criada.");
      } else {
        await api.chargeCategories.update(editingCategory.id, body);
        setMessage("Categoria atualizada.");
      }
      setEditingCategory(null);
      await load();
    } catch (err) {
      setError(ptError(err));
    }
  }

  async function deactivateCategory(category: ChargeCategory) {
    setError(null);
    try {
      await api.chargeCategories.remove(category.id);
      setMessage(`Categoria ${category.name} desativada.`);
      await load();
    } catch (err) {
      setError(ptError(err));
    }
  }

  async function reactivateCategory(category: ChargeCategory) {
    setError(null);
    try {
      await api.chargeCategories.update(category.id, { active: true });
      setMessage(`Categoria ${category.name} reativada.`);
      await load();
    } catch (err) {
      setError(ptError(err));
    }
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    const price = parseMoneyInput(productForm.price);
    if (!productForm.categoryId || !productForm.name.trim() || !(price > 0)) {
      setError("Informe categoria, nome e preço.");
      return;
    }
    setError(null);
    try {
      await api.products.create({
        categoryId: productForm.categoryId,
        name: productForm.name.trim(),
        code: productForm.code.trim() || null,
        price,
        unit: productForm.unit.trim() || null,
      });
      setMessage("Produto cadastrado.");
      setProductForm((prev) => ({
        ...prev,
        name: "",
        code: "",
        price: "",
        unit: "",
      }));
      await load();
      requestAnimationFrame(() => nameInputRef.current?.focus());
    } catch (err) {
      setError(ptError(err));
    }
  }

  async function saveInlinePrice(product: Product) {
    const price = parseMoneyInput(priceDraft);
    if (!(price > 0)) {
      setError("Preço inválido.");
      return;
    }
    setError(null);
    try {
      await api.products.update(product.id, { price });
      setMessage(`Preço de ${product.name} atualizado.`);
      setEditingPriceId(null);
      await load();
    } catch (err) {
      setError(ptError(err));
    }
  }

  async function toggleProductActive(product: Product) {
    setError(null);
    try {
      if (product.active) {
        await api.products.remove(product.id);
        setMessage(`${product.name} desativado.`);
      } else {
        await api.products.update(product.id, { active: true });
        setMessage(`${product.name} reativado.`);
      }
      await load();
    } catch (err) {
      setError(ptError(err));
    }
  }

  if (loading) return <Loading label="Carregando produtos…" />;

  return (
    <section className="page settings-page rooms-tabs-page">
      <header className="settings-page-header">
        <h1>Produtos</h1>
        <p className="muted">
          Cadastre itens com preço e categorias próprias. Texto livre no
          lançamento continua disponível.
        </p>
      </header>

      <Feedback error={error} message={message} />

      <div className="settings-shell">
        <div className="settings-tabs-bar rooms-tabs-bar">
          <nav
            className="settings-tabs"
            role="tablist"
            aria-label="Seções de produtos"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? "active" : undefined}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon}
                  <span className="settings-tab-short">{tab.shortLabel}</span>
                  <span className="settings-tab-full">{tab.label}</span>
                  {active ? <span className="settings-tab-indicator" /> : null}
                </button>
              );
            })}
          </nav>
          <div className="rooms-tabs-actions">
            {activeTab === "products" ? (
              <>
                <Button
                  icon={<Upload size={16} />}
                  onClick={() => setImportOpen(true)}
                  disabled={categories.filter((c) => c.active).length === 0}
                >
                  Importar
                </Button>
                <Button
                  variant="primary"
                  icon={<Plus size={16} />}
                  onClick={() => {
                    setProductFormOpen(true);
                    requestAnimationFrame(() => nameInputRef.current?.focus());
                  }}
                  disabled={categories.filter((c) => c.active).length === 0}
                >
                  Novo produto
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                icon={<Plus size={16} />}
                onClick={() => setEditingCategory("new")}
              >
                Nova categoria
              </Button>
            )}
          </div>
        </div>

        <div className="settings-tab-panel">
          {activeTab === "categories" ? (
            <div role="tabpanel" className="products-tab-panel">
              {categories.length === 0 ? (
                <EmptyState message="Nenhuma categoria. Crie categorias para organizar o lançamento." />
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Grupo</th>
                        <th>Produtos</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((cat) => (
                        <tr
                          key={cat.id}
                          className={cat.active ? undefined : "row-inactive"}
                        >
                          <td>
                            <span className="products-name-cell">
                              {cat.icon ? (
                                <Icon name={cat.icon} size={16} />
                              ) : null}
                              {cat.name}
                            </span>
                          </td>
                          <td>
                            <span className="muted">{cat.groupLabel}</span>
                            <div className="products-group-hint">
                              {
                                GROUP_OPTIONS.find((g) => g.value === cat.group)
                                  ?.hint
                              }
                            </div>
                          </td>
                          <td>{cat.productsCount}</td>
                          <td>{cat.active ? "Ativa" : "Desativada"}</td>
                          <td className="table-actions">
                            <Button
                              icon={<Pencil size={14} />}
                              onClick={() => setEditingCategory(cat)}
                            >
                              Editar
                            </Button>
                            {cat.active ? (
                              <Button
                                icon={<Power size={14} />}
                                onClick={() => void deactivateCategory(cat)}
                              >
                                Desativar
                              </Button>
                            ) : (
                              <Button
                                icon={<Power size={14} />}
                                onClick={() => void reactivateCategory(cat)}
                              >
                                Reativar
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div role="tabpanel" className="products-tab-panel">
              <div className="products-toolbar">
                <label className="products-search">
                  <Search size={16} />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar por nome ou código"
                  />
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">Todas as categorias</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {filteredProducts.length === 0 ? (
                <EmptyState message="Nenhum produto. Cadastre itens do frigobar, restaurante e outros serviços." />
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Categoria</th>
                        <th>Preço</th>
                        <th>Unidade</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr
                          key={product.id}
                          className={
                            product.active ? undefined : "row-inactive"
                          }
                        >
                          <td>
                            <strong>{product.name}</strong>
                            {product.code ? (
                              <div className="muted">{product.code}</div>
                            ) : null}
                          </td>
                          <td>{product.category?.name ?? "—"}</td>
                          <td>
                            {editingPriceId === product.id ? (
                              <div className="inline-price-edit">
                                <input
                                  value={priceDraft}
                                  onChange={(e) =>
                                    setPriceDraft(moneyInputMask(e.target.value))
                                  }
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      void saveInlinePrice(product);
                                    }
                                    if (e.key === "Escape") {
                                      setEditingPriceId(null);
                                    }
                                  }}
                                />
                                <Button
                                  variant="primary"
                                  onClick={() => void saveInlinePrice(product)}
                                >
                                  Salvar
                                </Button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="linkish"
                                onClick={() => {
                                  setEditingPriceId(product.id);
                                  setPriceDraft(
                                    formatMoneyInput(Number(product.price)),
                                  );
                                }}
                                title="Clique para editar o preço"
                              >
                                {brl(product.price)}
                              </button>
                            )}
                            {editingPriceId === product.id ? (
                              <p className="products-price-hint muted">
                                O novo preço vale para os próximos lançamentos.
                                Contas abertas não mudam.
                              </p>
                            ) : null}
                          </td>
                          <td>{product.unit || "—"}</td>
                          <td>{product.active ? "Ativo" : "Desativado"}</td>
                          <td className="table-actions">
                            <Button
                              icon={<Power size={14} />}
                              onClick={() => void toggleProductActive(product)}
                            >
                              {product.active ? "Desativar" : "Reativar"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editingCategory ? (
        <Modal
          title={
            editingCategory === "new" ? "Nova categoria" : "Editar categoria"
          }
          onClose={() => setEditingCategory(null)}
        >
          <form className="stack-form" onSubmit={saveCategory}>
            <Field label="Nome">
              <input
                name="name"
                required
                defaultValue={
                  editingCategory === "new" ? "" : editingCategory.name
                }
                placeholder="Ex.: Frigobar"
              />
            </Field>
            <Field label="Como soma na conta?">
              <select
                name="group"
                required
                defaultValue={
                  editingCategory === "new"
                    ? "CONSUMPTION"
                    : editingCategory.group
                }
              >
                {GROUP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} — {opt.hint}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ícone">
              <select
                name="icon"
                defaultValue={
                  editingCategory === "new"
                    ? "receipt"
                    : (editingCategory.icon ?? "receipt")
                }
              >
                {ICON_OPTIONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </Field>
            <div className="modal-actions">
              <Button type="button" onClick={() => setEditingCategory(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Salvar
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {productFormOpen ? (
        <Modal
          title="Novo produto"
          onClose={() => setProductFormOpen(false)}
        >
          <form className="stack-form" onSubmit={saveProduct}>
            <Field label="Categoria">
              <select
                value={productForm.categoryId}
                onChange={(e) =>
                  setProductForm((prev) => ({
                    ...prev,
                    categoryId: e.target.value,
                  }))
                }
                required
              >
                {categories
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Nome">
              <input
                ref={nameInputRef}
                value={productForm.name}
                onChange={(e) =>
                  setProductForm((prev) => ({ ...prev, name: e.target.value }))
                }
                required
                placeholder="Ex.: Coca-Cola 350ml"
              />
            </Field>
            <Field label="Código (opcional)">
              <input
                value={productForm.code}
                onChange={(e) =>
                  setProductForm((prev) => ({ ...prev, code: e.target.value }))
                }
                placeholder="Código interno ou de barras"
              />
            </Field>
            <Field label="Preço">
              <input
                value={productForm.price}
                onChange={(e) =>
                  setProductForm((prev) => ({
                    ...prev,
                    price: moneyInputMask(e.target.value),
                  }))
                }
                required
                inputMode="numeric"
                placeholder="0,00"
              />
            </Field>
            <Field label="Unidade (opcional)">
              <input
                value={productForm.unit}
                onChange={(e) =>
                  setProductForm((prev) => ({ ...prev, unit: e.target.value }))
                }
                placeholder="un, gf, kg, porção"
              />
            </Field>
            <p className="muted products-price-hint">
              Depois de salvar, o formulário limpa e mantém a categoria para
              cadastrar o próximo.
            </p>
            <div className="modal-actions">
              <Button type="button" onClick={() => setProductFormOpen(false)}>
                Fechar
              </Button>
              <Button type="submit" variant="primary">
                Salvar e continuar
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {importOpen ? (
        <ImportModal
          categories={categories.filter((c) => c.active)}
          onClose={() => setImportOpen(false)}
          onDone={async (count) => {
            setImportOpen(false);
            setMessage(`${count} produto(s) importado(s).`);
            await load();
          }}
          onError={(msg) => setError(msg)}
        />
      ) : null}
    </section>
  );
}

function ImportModal({
  categories,
  onClose,
  onDone,
  onError,
}: {
  categories: ChargeCategory[];
  onClose: () => void;
  onDone: (count: number) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const preview = parseImportLines(text);

  async function confirm() {
    if (!categoryId || preview.length === 0) {
      onError("Cole linhas no formato nome, preço e escolha a categoria.");
      return;
    }
    setBusy(true);
    try {
      await api.products.createBatch({
        categoryId,
        items: preview,
      });
      await onDone(preview.length);
    } catch (err) {
      onError(ptError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Importar produtos" onClose={onClose} wide>
      <div className="stack-form">
        <Field label="Categoria">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Colar do Excel (nome, preço — uma linha por produto)">
          <textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Água mineral, 4,00\nCoca-Cola 350ml, 8,50"}
          />
        </Field>
        {preview.length > 0 ? (
          <div className="import-preview">
            <strong>Prévia · {preview.length} item(ns)</strong>
            <ul>
              {preview.slice(0, 12).map((row) => (
                <li key={`${row.name}-${row.price}`}>
                  {row.name} — {brl(row.price)}
                </li>
              ))}
              {preview.length > 12 ? (
                <li className="muted">… e mais {preview.length - 12}</li>
              ) : null}
            </ul>
          </div>
        ) : null}
        <div className="modal-actions">
          <Button type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={busy || preview.length === 0}
            onClick={() => void confirm()}
          >
            Confirmar importação
          </Button>
        </div>
      </div>
    </Modal>
  );
}
