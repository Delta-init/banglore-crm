package com.callrecorder.ui.contacts

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.callrecorder.data.db.ContactEntity
import com.callrecorder.databinding.ItemContactBinding

class ContactAdapter(
    private val onEdit:   (ContactEntity) -> Unit,
    private val onDelete: (ContactEntity) -> Unit,
    private val onCall:   (ContactEntity) -> Unit
) : ListAdapter<ContactEntity, ContactAdapter.VH>(DIFF) {

    inner class VH(private val b: ItemContactBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(c: ContactEntity) {
            // Avatar initial
            b.tvInitial.text = c.name.firstOrNull()?.uppercase() ?: "?"

            b.tvName.text  = c.name
            b.tvPhone.text = c.phone
            b.tvEmail.text = c.email ?: ""

            b.btnCall.setOnClickListener   { onCall(c) }
            b.btnEdit.setOnClickListener   { onEdit(c) }
            b.btnDelete.setOnClickListener { onDelete(c) }

            // Show imported badge if came from device contacts
            b.tvImported.visibility =
                if (c.deviceContactId != null) android.view.View.VISIBLE else android.view.View.GONE
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val b = ItemContactBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return VH(b)
    }

    override fun onBindViewHolder(holder: VH, position: Int) = holder.bind(getItem(position))

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<ContactEntity>() {
            override fun areItemsTheSame(a: ContactEntity, b: ContactEntity) = a.id == b.id
            override fun areContentsTheSame(a: ContactEntity, b: ContactEntity) = a == b
        }
    }
}
