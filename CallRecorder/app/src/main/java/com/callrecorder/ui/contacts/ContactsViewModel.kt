package com.callrecorder.ui.contacts

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.callrecorder.data.db.ContactEntity
import com.callrecorder.data.repository.ContactRepository
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalCoroutinesApi::class, FlowPreview::class)
class ContactsViewModel(app: Application) : AndroidViewModel(app) {

    private val repo = ContactRepository(app)

    val searchQuery = MutableStateFlow("")

    val contacts: StateFlow<List<ContactEntity>> = searchQuery
        .debounce(250)
        .flatMapLatest { q -> repo.search(q) }
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    private val _importResult = MutableStateFlow<ImportState>(ImportState.Idle)
    val importResult: StateFlow<ImportState> = _importResult

    fun save(contact: ContactEntity) {
        viewModelScope.launch {
            if (contact.id == 0) repo.insert(contact) else repo.update(contact)
        }
    }

    fun delete(contact: ContactEntity) {
        viewModelScope.launch { repo.delete(contact) }
    }

    fun importFromDevice() {
        viewModelScope.launch {
            _importResult.value = ImportState.Loading
            val count = repo.importFromDevice()
            _importResult.value = ImportState.Done(count)
        }
    }

    fun clearImportResult() { _importResult.value = ImportState.Idle }

    sealed class ImportState {
        object Idle    : ImportState()
        object Loading : ImportState()
        data class Done(val count: Int) : ImportState()
    }
}
