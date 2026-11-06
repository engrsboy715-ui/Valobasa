import { useEffect, useState } from 'react';
import { submitKyc, fetchMyKyc, type Profile, type KycSubmission } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  ChevronLeft,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Check,
  X,
  Camera,
  Upload,
  Loader2,
  IdCard,
  MapPin,
  Calendar,
  User as UserIcon,
} from 'lucide-react';

type IdType = 'NID Card' | 'Passport';
type Gender = 'Male' | 'Female' | 'Other';

export function VerificationView({ onBack }: { onBack: () => void }) {
  const { profile, refreshProfile } = useAuth();
  const [existing, setExisting] = useState<KycSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // form fields
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [idType, setIdType] = useState<IdType>('NID Card');
  const [idNumber, setIdNumber] = useState('');
  const [country, setCountry] = useState('Bangladesh');
  const [address, setAddress] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender>('Male');
  const [frontImg, setFrontImg] = useState('');
  const [backImg, setBackImg] = useState('');
  const [selfieImg, setSelfieImg] = useState('');

  useEffect(() => {
    loadKyc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadKyc = async () => {
    setLoading(true);
    const kyc = await fetchMyKyc();
    setExisting(kyc);
    if (kyc) {
      setFullName(kyc.full_name);
      setIdType(kyc.id_type as IdType);
      setIdNumber(kyc.id_number);
      setCountry(kyc.country);
      setAddress(kyc.address);
      setDob(kyc.date_of_birth);
      setGender(kyc.gender as Gender);
      setFrontImg(kyc.id_front_img);
      setBackImg(kyc.id_back_img);
      setSelfieImg(kyc.selfie_img);
    }
    setLoading(false);
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFile = async (file: File | undefined, setter: (s: string) => void) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setToast({ msg: 'Image must be under 4MB.', ok: false });
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setter(dataUrl);
  };

  const canSubmit =
    fullName.trim().length > 1 &&
    idNumber.trim().length > 2 &&
    country.trim().length > 0 &&
    address.trim().length > 3 &&
    dob.trim().length > 0 &&
    frontImg && backImg && selfieImg;

  const submit = async () => {
    if (!canSubmit) {
      setToast({ msg: 'Please fill all fields and upload all three images.', ok: false });
      return;
    }
    setSubmitting(true);
    const { error } = await submitKyc({
      full_name: fullName.trim(),
      id_type: idType,
      id_number: idNumber.trim(),
      country: country.trim(),
      address: address.trim(),
      date_of_birth: dob.trim(),
      gender,
      id_front_img: frontImg,
      id_back_img: backImg,
      selfie_img: selfieImg,
    });
    setSubmitting(false);
    if (error) {
      setToast({ msg: error.message || 'Submission failed.', ok: false });
      return;
    }
    setToast({ msg: 'KYC submitted! Admin will review your documents.', ok: true });
    await loadKyc();
    await refreshProfile();
  };

  const status = existing?.status ?? profile?.kyc_status ?? 'none';
  const isLocked = status === 'pending' || status === 'verified';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:scale-95">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-slate-800">Identity Verification (KYC)</h1>
      </div>

      <div className="space-y-5 px-4 py-5 pb-24">
        {/* Status banner */}
        <StatusBanner status={status} adminNote={existing?.admin_note ?? null} />

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
          </div>
        ) : status === 'verified' ? (
          <VerifiedDetails
            existing={existing!}
            fullName={fullName}
            idType={idType}
            idNumber={idNumber}
            country={country}
            address={address}
            dob={dob}
            gender={gender}
            frontImg={frontImg}
            backImg={backImg}
            selfieImg={selfieImg}
          />
        ) : (
          <>
            {/* Personal info */}
            <div className="card space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <UserIcon size={16} className="text-violet-600" /> Personal Information
              </h2>

              <Field label="Full Name (as on ID)">
                <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" disabled={isLocked} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="ID Type">
                  <select className="input" value={idType} onChange={(e) => setIdType(e.target.value as IdType)} disabled={isLocked}>
                    <option value="NID Card">NID Card</option>
                    <option value="Passport">Passport</option>
                  </select>
                </Field>
                <Field label="ID Number">
                  <input className="input" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="e.g. 1990123456" disabled={isLocked} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Country">
                  <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} disabled={isLocked} />
                </Field>
                <Field label="Date of Birth">
                  <input type="date" className="input" value={dob} onChange={(e) => setDob(e.target.value)} disabled={isLocked} />
                </Field>
              </div>

              <Field label="Address">
                <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House, road, city" disabled={isLocked} />
              </Field>

              <Field label="Gender">
                <div className="flex gap-2">
                  {(['Male', 'Female', 'Other'] as Gender[]).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      disabled={isLocked}
                      className={cn(
                        'flex-1 rounded-xl border py-2.5 text-sm font-semibold transition',
                        gender === g ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600'
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            {/* Document uploads */}
            <div className="card space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <IdCard size={16} className="text-violet-600" /> Document Uploads
              </h2>
              <p className="text-xs text-slate-500">Upload or capture clear photos of your documents.</p>

              <UploadSlot
                label="ID Card Front Image"
                img={frontImg}
                onChange={(f) => handleFile(f, setFrontImg)}
                disabled={isLocked}
              />
              <UploadSlot
                label="ID Card Back Image"
                img={backImg}
                onChange={(f) => handleFile(f, setBackImg)}
                disabled={isLocked}
              />
              <UploadSlot
                label="Live Selfie (Front Photo)"
                img={selfieImg}
                onChange={(f) => handleFile(f, setSelfieImg)}
                capture
                disabled={isLocked}
              />
            </div>

            {status !== 'pending' && (
              <button
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="brand-btn w-full py-3.5 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                {status === 'rejected' ? 'Resubmit for Review' : 'Submit for Verification'}
              </button>
            )}
          </>
        )}
      </div>

      {toast && <Toast message={toast.msg} onClose={() => setToast(null)} tone={toast.ok ? 'success' : 'error'} />}
    </div>
  );
}

function StatusBanner({ status, adminNote }: { status: string; adminNote: string | null }) {
  if (status === 'verified') {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
        <Check size={20} className="mt-0.5 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-bold text-emerald-800">Identity Verified</p>
          <p className="text-xs text-emerald-700">Your KYC has been approved. You're fully verified.</p>
        </div>
      </div>
    );
  }
  if (status === 'pending') {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
        <Clock size={20} className="mt-0.5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-bold text-amber-800">Verification Under Review</p>
          <p className="text-xs text-amber-700">Admin is reviewing your documents. This usually takes 24–48 hours.</p>
        </div>
      </div>
    );
  }
  if (status === 'rejected') {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200">
        <ShieldAlert size={20} className="mt-0.5 shrink-0 text-rose-600" />
        <div>
          <p className="text-sm font-bold text-rose-800">Verification Rejected</p>
          <p className="text-xs text-rose-700">{adminNote ?? 'Please review your documents and resubmit.'}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <ShieldCheck size={20} className="mt-0.5 shrink-0 text-slate-500" />
      <div>
        <p className="text-sm font-bold text-slate-700">Not Verified Yet</p>
        <p className="text-xs text-slate-500">Complete your KYC to unlock all features and withdrawals.</p>
      </div>
    </div>
  );
}

function VerifiedDetails({
  existing,
  fullName,
  idType,
  idNumber,
  country,
  address,
  dob,
  gender,
  frontImg,
  backImg,
  selfieImg,
}: {
  existing: KycSubmission;
  fullName: string;
  idType: string;
  idNumber: string;
  country: string;
  address: string;
  dob: string;
  gender: string;
  frontImg: string;
  backImg: string;
  selfieImg: string;
}) {
  return (
    <>
      <div className="card space-y-3">
        <h2 className="text-sm font-bold text-slate-800">Verified Information</h2>
        <DetailRow icon={<UserIcon size={14} />} label="Full Name" value={fullName} />
        <DetailRow icon={<IdCard size={14} />} label="ID Type" value={idType} />
        <DetailRow icon={<IdCard size={14} />} label="ID Number" value={idNumber} />
        <DetailRow icon={<MapPin size={14} />} label="Country" value={country} />
        <DetailRow icon={<MapPin size={14} />} label="Address" value={address} />
        <DetailRow icon={<Calendar size={14} />} label="Date of Birth" value={dob} />
        <DetailRow icon={<UserIcon size={14} />} label="Gender" value={gender} />
        <DetailRow icon={<Clock size={14} />} label="Submitted" value={new Date(existing.created_at).toLocaleDateString()} />
      </div>

      <div className="card space-y-3">
        <h2 className="text-sm font-bold text-slate-800">Documents</h2>
        <div className="grid grid-cols-3 gap-2">
          <DocPreview label="ID Front" img={frontImg} />
          <DocPreview label="ID Back" img={backImg} />
          <DocPreview label="Selfie" img={selfieImg} />
        </div>
      </div>
    </>
  );
}

function DocPreview({ label, img }: { label: string; img: string }) {
  return (
    <div>
      <img src={img} alt={label} className="aspect-[3/4] w-full rounded-xl object-cover ring-1 ring-slate-200" />
      <p className="mt-1 text-center text-[10px] font-medium text-slate-500">{label}</p>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
      <span className="flex items-center gap-2 text-sm text-slate-500">{icon} {label}</span>
      <span className="text-sm font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function UploadSlot({
  label,
  img,
  onChange,
  capture,
  disabled,
}: {
  label: string;
  img: string;
  onChange: (f: File | undefined) => void;
  capture?: boolean;
  disabled?: boolean;
}) {
  const inputId = `upload-${label.replace(/\s/g, '-').toLowerCase()}`;
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
          {img ? (
            <img src={img} alt={label} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <Camera size={22} />
            </div>
          )}
        </div>
        {!disabled && (
          <div className="flex flex-1 flex-col gap-2">
            <label
              htmlFor={inputId}
              className="flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 py-2.5 text-sm font-semibold text-violet-700 transition active:scale-95 hover:bg-violet-100 cursor-pointer"
            >
              <Upload size={16} /> Upload
            </label>
            {capture && (
              <label
                htmlFor={`${inputId}-cam`}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 transition active:scale-95 hover:bg-slate-50 cursor-pointer"
              >
                <Camera size={16} /> Take Photo
              </label>
            )}
            <input
              id={inputId}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onChange(e.target.files?.[0])}
            />
            {capture && (
              <input
                id={`${inputId}-cam`}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => onChange(e.target.files?.[0])}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
