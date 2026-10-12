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
const programForm = document.querySelector("#program-form");
const programDialog = document.querySelector("#program-dialog");
const programList = document.querySelector("#program-list");
const programTableWrapper = document.querySelector("#program-table-wrapper");
const programLoading = document.querySelector("#program-loading");
const programEmptyState = document.querySelector("#program-empty-state");
const programCount = document.querySelector("#program-count");
const uploadButton = document.querySelector("#upload-button");

let editingId = null;

function errorMessage(error, fallback) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  if (Array.isArray(error)) {
    return error
      .map((item) => (typeof item === "object" ? item.msg : item))
      .filter(Boolean)
      .join(" ");
  }
  if (error && typeof error === "object") {
    return error.detail ? errorMessage(error.detail, fallback) : fallback;
  }
  return fallback;
}

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

function normalizeProgram(row) {
  if (Array.isArray(row)) {
    const [id, name, path] = row;
    return { id, name, path };
  }

  return { id: row.id, name: row.name, path: row.path };
}

function renderPrograms(rows) {
  programList.replaceChildren();
  const programs = rows.map(normalizeProgram);
  programCount.textContent = `${programs.length} ${programs.length === 1 ? "programa" : "programas"}`;
  programLoading.hidden = true;
  programEmptyState.hidden = programs.length !== 0;
  programTableWrapper.hidden = programs.length === 0;

  for (const program of programs) {
    const row = document.createElement("tr");
    const nameCell = valueCell(program.name);
    nameCell.className = "name-cell";
    row.append(nameCell, valueCell(program.path));

    const actions = document.createElement("td");
    actions.className = "actions";
    const deleteButton = document.createElement("button");
    deleteButton.className = "action-button action-danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Excluir";
    deleteButton.addEventListener("click", () => removeProgram(program));
    actions.append(deleteButton);
    row.append(actions);
    programList.append(row);
  }
}

async function loadPrograms() {
  programLoading.hidden = false;
  programTableWrapper.hidden = true;
  programEmptyState.hidden = true;
  programCount.textContent = "Carregando...";

  try {
    const response = await fetch("/programs");
    if (!response.ok) throw new Error("Não foi possível carregar os programas.");
    renderPrograms(await response.json());
  } catch (error) {
    programLoading.hidden = true;
    programCount.textContent = "Não foi possível carregar";
    showFeedback(error.message);
  }
}

function openProgramDialog() {
  programForm.reset();
  programDialog.showModal();
  programForm.elements.name.focus();
}

function closeProgramDialog() {
  programDialog.close();
  programForm.reset();
}

async function uploadProgram(event) {
  event.preventDefault();
  uploadButton.disabled = true;

  try {
    const response = await fetch("/programs", {
      method: "POST",
      body: new FormData(programForm),
    });

    if (!response.ok) {
      let message = "Não foi possível enviar o programa.";
      try {
        const details = await response.json();
        if (details.detail) message = errorMessage(details.detail, message);
      } catch {
        // Use the generic message when the server does not return JSON.
      }
      throw new Error(message);
    }

    closeProgramDialog();
    await loadPrograms();
    showFeedback("Programa enviado com sucesso.", "success");
  } catch (error) {
    showFeedback(error.message);
  } finally {
    uploadButton.disabled = false;
  }
}

async function removeProgram(program) {
  if (!window.confirm(`Excluir o programa "${program.name}"?`)) return;

  try {
    const response = await fetch(`/programs/${program.id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Não foi possível excluir o programa.");
    await loadPrograms();
    showFeedback("Programa excluído.", "success");
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
document.querySelector("#new-program-button").addEventListener("click", openProgramDialog);
document.querySelector("#cancel-program-button").addEventListener("click", closeProgramDialog);
document.querySelector("#close-program-dialog-button").addEventListener("click", closeProgramDialog);
programForm.addEventListener("submit", uploadProgram);
programDialog.addEventListener("click", (event) => {
  if (event.target === programDialog) closeProgramDialog();
});

loadAmbients();
loadPrograms();