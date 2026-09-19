with open('src/pages/profile/ProfilePage.tsx', 'r') as f:
    content = f.read()

# Remove the College / Institution Information section
# It starts with the comment and the card div, ends before Account Information
old_section = """{/* ── College / Institution Information ── */}
      <div className="card p-6">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-violet-400" /> College / Institution Information
          </h3>
          {canEditCollegeInfo && !instEditing && (
            <button
              type="button"
              className="btn-secondary !py-1.5 !px-3 text-xs"
              onClick={() =>
                startInstEdit(institution ?? { id: 1, name: instName || '', address: instAddress || '' })
              }
            >
              <Pencil className="w-3.5 h-3.5" /> Edit College Info
            </button>
          )}
        </div>

        {instEditing ? (
          <form onSubmit={handleInstSave} className="space-y-5">
            <div className="form-group">
              <label htmlFor="instName" className="label">College Name</label>
              <input
                id="instName"
                type="text"
                className="input"
                value={instForm.name}
                onChange={(e) => setInstForm({ ...instForm, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="instAddress" className="label">College Address</label>
              <textarea
                id="instAddress"
                className="input min-h-24 resize-y"
                value={instForm.address}
                onChange={(e) => setInstForm({ ...instForm, address: e.target.value })}
              />
            </div>
            {instSaveError && (
              <div className="p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-semibold animate-fade-in flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {instSaveError}
              </div>
            )}
            <div className="form-footer">
              <button
                type="button"
                className="btn-secondary"
                disabled={updateInstitution.isPending}
                onClick={() => setInstEditing(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={updateInstitution.isPending}
              >
                {updateInstitution.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                ) : (
                  <><Save className="w-4 h-4" /> Save College Info</>
                )}
              </button>
            </form>
          </form>
        ) : (
          <>
            {instSaved && (
              <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-semibold animate-fade-in flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4" /> College information updated successfully!
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
              <div>
                <InfoRow
                  label="College Name"
                  value={
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-gray-500" /> {instName || '—'}
                    </span>
                  }
                />
              </div>
              <div>
                <InfoRow
                  label="College Address"
                  value={
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-gray-500" /> {instAddress || '—'}
                    </span>
                  }
                />
              </div>
            </div>
            <p className="text-[11px] text-gray-600 mt-3">
              }"""

# Replace with just the account info comment
new_section = "{/* ── Account Information ── */}"

if old_section in content:
    content = content.replace(old_section, new_section)
    with open('src/pages/profile/ProfilePage.tsx', 'w') as f:
        f.write(content)
    print("Successfully removed College section")
else:
    print("Old section not found")
    # Try to find it
    idx = content.find("{/* ── College / Institution Information ── */}")
    if idx >= 0:
        print(f"Found college section comment at index {idx}")
    else:
        print("College section comment not found")

# Also fix the broken `}` on the p tag
content2 = content.replace('<p className="text-[11px] text-gray-600 mt-3">\n              }', '<p className="text-[11px] text-gray-600 mt-3"></p>')
if content2 != content:
    with open('src/pages/profile/ProfilePage.tsx', 'w') as f:
        f.write(content2)
    print("Fixed broken p tag")
else:
    print("Broken p tag fix not needed (or already fixed)")