package com.callrecorder.ui.contacts

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.core.widget.addTextChangedListener
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import com.callrecorder.R
import com.callrecorder.data.db.ContactEntity
import com.callrecorder.databinding.DialogAddEditContactBinding
import com.callrecorder.databinding.FragmentContactsBinding
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.launch

class ContactsFragment : Fragment() {

    private var _binding: FragmentContactsBinding? = null
    private val binding get() = _binding!!

    private val viewModel: ContactsViewModel by viewModels()
    private lateinit var adapter: ContactAdapter

    private val contactsPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) viewModel.importFromDevice()
        else Toast.makeText(requireContext(), "Contacts permission denied", Toast.LENGTH_SHORT).show()
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentContactsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerView()
        setupSearch()
        setupFab()
        setupImportButton()
        observeState()
    }

    private fun setupRecyclerView() {
        adapter = ContactAdapter(
            onEdit   = { contact -> showAddEditDialog(contact) },
            onDelete = { contact -> confirmDelete(contact) },
            onCall   = { contact -> dialNumber(contact.phone) }
        )
        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@ContactsFragment.adapter
        }
    }

    private fun setupSearch() {
        binding.etSearch.addTextChangedListener { text ->
            viewModel.searchQuery.value = text?.toString() ?: ""
        }
    }

    private fun setupFab() {
        binding.fabAdd.setOnClickListener { showAddEditDialog(null) }
    }

    private fun setupImportButton() {
        binding.btnImport.setOnClickListener {
            when {
                ContextCompat.checkSelfPermission(
                    requireContext(), Manifest.permission.READ_CONTACTS
                ) == PackageManager.PERMISSION_GRANTED -> viewModel.importFromDevice()

                else -> contactsPermLauncher.launch(Manifest.permission.READ_CONTACTS)
            }
        }
    }

    private fun observeState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    viewModel.contacts.collect { contacts ->
                        adapter.submitList(contacts)
                        binding.emptyState.visibility =
                            if (contacts.isEmpty()) View.VISIBLE else View.GONE
                        binding.recyclerView.visibility =
                            if (contacts.isNotEmpty()) View.VISIBLE else View.GONE
                    }
                }
                launch {
                    viewModel.importResult.collect { state ->
                        when (state) {
                            is ContactsViewModel.ImportState.Loading -> {
                                binding.progressBar.visibility = View.VISIBLE
                                binding.btnImport.isEnabled = false
                            }
                            is ContactsViewModel.ImportState.Done -> {
                                binding.progressBar.visibility = View.GONE
                                binding.btnImport.isEnabled = true
                                val msg = if (state.count > 0)
                                    "Imported ${state.count} contacts"
                                else
                                    "No new contacts to import"
                                Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
                                viewModel.clearImportResult()
                            }
                            else -> {
                                binding.progressBar.visibility = View.GONE
                                binding.btnImport.isEnabled = true
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Add / Edit dialog ─────────────────────────────────────────────────────

    private fun showAddEditDialog(existing: ContactEntity?) {
        val dialogBinding = DialogAddEditContactBinding.inflate(layoutInflater)
        val isEdit = existing != null

        if (isEdit && existing != null) {
            dialogBinding.etName.setText(existing.name)
            dialogBinding.etPhone.setText(existing.phone)
            dialogBinding.etEmail.setText(existing.email ?: "")
            dialogBinding.etNotes.setText(existing.notes ?: "")
        }

        MaterialAlertDialogBuilder(requireContext())
            .setTitle(if (isEdit) "Edit Contact" else "New Contact")
            .setView(dialogBinding.root)
            .setPositiveButton(if (isEdit) "Save" else "Add") { _, _ ->
                val name  = dialogBinding.etName.text.toString().trim()
                val phone = dialogBinding.etPhone.text.toString().trim()
                val email = dialogBinding.etEmail.text.toString().trim().takeIf { it.isNotBlank() }
                val notes = dialogBinding.etNotes.text.toString().trim().takeIf { it.isNotBlank() }

                if (name.isBlank() || phone.isBlank()) {
                    Toast.makeText(requireContext(), "Name and phone are required", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }

                val contact = ContactEntity(
                    id              = existing?.id ?: 0,
                    name            = name,
                    phone           = phone,
                    email           = email,
                    notes           = notes,
                    deviceContactId = existing?.deviceContactId,
                    createdAt       = existing?.createdAt ?: System.currentTimeMillis()
                )
                viewModel.save(contact)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun confirmDelete(contact: ContactEntity) {
        AlertDialog.Builder(requireContext())
            .setTitle("Delete Contact")
            .setMessage("Delete ${contact.name}? This cannot be undone.")
            .setPositiveButton("Delete") { _, _ -> viewModel.delete(contact) }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun dialNumber(phone: String) {
        if (phone.isBlank()) return
        startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
