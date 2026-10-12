const form = document.querySelector("#ambient-form");
const dialog = document.querySelector("#ambient-dialog");
const ambientList = document.querySelector("#ambient-list");
const tableWrapper = document.querySelector("#table-wrapper");
const loading = document.querySelector("#loading");
const emptyState = document.querySelector("#empty-state");
const feedback = document.querySelector("#feedback");
const count = document.querySelector("#ambient-count");
const dialogTitle = document.querySelector("#dialog-title");
const saveButton = document.querySelector("#save-button");

let editingId = null;

function showFeedback(message, type = "error") {
  feedback.textContent = message;
  feedback.className = `feedback feedback-${type}`;
  feedback.hidden = false;
}

function clearFeedback() {
  feedback.hidden = true;
}

function normalizeAmbient(row) {
  if (Array.isArray(row)) {
    const [id, name, cpuWeight, cpuMax, memoryMax, memorySwapMax, ioMax] = row;
    return { id, name, cpuWeight, cpuMax, memoryMax, memorySwapMax, ioMax };
  }

  return {
    id: row.id,
    name: row.name,
    cpuWeight: row.cpu_weight,
    cpuMax: row.cpu_max,
    memoryMax: row.memory_max,
    memorySwapMax: row.memory_swap_max,
    ioMax: row.io_max,
  };
}

function valueCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  return cell;
}

function renderAmbients(rows) {
  ambientList.replaceChildren();
  const ambients = rows.map(normalizeAmbient);
  count.textContent = `${ambients.length} ${ambients.length === 1 ? "ambiente" : "ambientes"}`;
  loading.hidden = true;
  emptyState.hidden = ambients.length !== 0;
  tableWrapper.hidden = ambients.length === 0;

  for (const ambient of ambients) {
    const row = document.createElement("tr");
    const nameCell = valueCell(ambient.name);
    nameCell.className = "name-cell";
    row.append(
      nameCell,
      valueCell(ambient.cpuWeight),
      valueCell(ambient.cpuMax),
      valueCell(ambient.memoryMax),
      valueCell(ambient.memorySwapMax),
      valueCell(ambient.ioMax),
    );

    const actions = document.createElement("td");
    actions.className = "actions";
    const editButton = document.createElement("button");
    editButton.className = "action-button";
    editButton.type = "button";
    editButton.textContent = "Editar";
    editButton.addEventListener("click", () => openEditDialog(ambient));
    const deleteButton = document.createElement("button");
    deleteButton.className = "action-button action-danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Excluir";
    deleteButton.addEventListener("click", () => removeAmbient(ambient));
    actions.append(editButton, deleteButton);
    row.append(actions);
    ambientList.append(row);
  }
}

async function loadAmbients() {
  clearFeedback();
  loading.hidden = false;
  tableWrapper.hidden = true;
  emptyState.hidden = true;
  count.textContent = "Carregando...";

  try {
    const response = await fetch("/ambients");
    if (!response.ok) throw new Error("Não foi possível carregar os ambientes.");
    renderAmbients(await response.json());
  } catch (error) {
    loading.hidden = true;
    count.textContent = "Não foi possível carregar";
    showFeedback(error.message);
  }
}

function openNewDialog() {
  editingId = null;
  dialogTitle.textContent = "Novo ambiente";
  saveButton.textContent = "Salvar ambiente";
  form.reset();
  dialog.showModal();
  form.elements.name.focus();
}

function openEditDialog(ambient) {
  editingId = ambient.id;
  dialogTitle.textContent = "Editar ambiente";
  saveButton.textContent = "Salvar alterações";
  form.elements.name.value = ambient.name;
  form.elements.cpu_weight.value = ambient.cpuWeight;
  form.elements.cpu_max.value = ambient.cpuMax;
  form.elements.memory_max.value = ambient.memoryMax;
  form.elements.memory_swap_max.value = ambient.memorySwapMax;
  form.elements.io_max.value = ambient.ioMax;
  dialog.showModal();
  form.elements.name.focus();
}

function closeDialog() {
  dialog.close();
  form.reset();
}

function formParameters() {
  const data = new FormData(form);
  return new URLSearchParams(data);
}

async function saveAmbient(event) {
  event.preventDefault();
  saveButton.disabled = true;

  try {
    const parameters = formParameters();
    const path = editingId === null ? "/ambients" : `/ambients/${editingId}`;
    const endpoint = `${path}?${parameters.toString()}`;
    const response = await fetch(endpoint, {
      method: editingId === null ? "POST" : "PUT",
    });
    if (!response.ok) throw new Error("Não foi possível salvar o ambiente.");
    const successMessage = editingId === null ? "Ambiente criado." : "Ambiente atualizado.";
    closeDialog();
    await loadAmbients();
    showFeedback(successMessage, "success");
  } catch (error) {
    showFeedback(error.message);
  } finally {
    saveButton.disabled = false;
  }
}

async function removeAmbient(ambient) {
  if (!window.confirm(`Excluir o ambiente "${ambient.name}"?`)) return;

  try {
    const response = await fetch(`/ambients/${ambient.id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Não foi possível excluir o ambiente.");
    await loadAmbients();
    showFeedback("Ambiente excluído.", "success");
  } catch (error) {
    showFeedback(error.message);
  }
}

document.querySelector("#new-ambient-button").addEventListener("click", openNewDialog);
document.querySelector("#refresh-button").addEventListener("click", loadAmbients);
document.querySelector("#cancel-button").addEventListener("click", closeDialog);
document.querySelector("#close-dialog-button").addEventListener("click", closeDialog);
form.addEventListener("submit", saveAmbient);
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeDialog();
});

loadAmbients();