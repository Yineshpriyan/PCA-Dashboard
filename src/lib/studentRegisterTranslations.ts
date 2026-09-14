export type StudentRegisterLang = 'en' | 'ta' | 'si';

export interface LangOption {
  code: StudentRegisterLang;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LangOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', flag: '🇱🇰' },
  { code: 'si', label: 'Sinhala', nativeLabel: 'සිංහල', flag: '🇱🇰' },
];

export interface StudentRegisterTranslations {
  nav: {
    portalBadge: string;
    subtitle: string;
    studentLogin: string;
    toggleThemeLight: string;
    toggleThemeDark: string;
    language: string;
  };
  form: {
    title: string;
    subtitle: string;
    firstName: string;
    firstNamePlaceholder: string;
    lastName: string;
    lastNamePlaceholder: string;
    batch: string;
    repeatDetails: string;
    properBatch: string;
    properBatchPlaceholder: string;
    joinedBatch: string;
    stream: string;
    streamBio: string;
    streamMaths: string;
    streamOther: string;
    school: string;
    schoolPlaceholder: string;
    fatherJob: string;
    fatherJobPlaceholder: string;
    motherJob: string;
    motherJobPlaceholder: string;
    nic: string;
    nicPlaceholder: string;
    gender: string;
    genderSelect: string;
    genderMale: string;
    genderFemale: string;
    genderOther: string;
    dob: string;
    phone: string;
    phonePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    address1: string;
    address1Placeholder: string;
    address2: string;
    address2Placeholder: string;
    district: string;
    footerNote: string;
    submit: string;
    submitting: string;
  };
  errors: {
    phoneInvalid: string;
    emailInvalid: string;
    nicInvalid: string;
    genderRequired: string;
    properBatchRequired: string;
    requiredFields: string;
    duplicateStudent: string;
    duplicatePhone: string;
    genericError: string;
  };
  success: {
    alreadyRegistered: string;
    newRegistration: string;
    existingTitle: string;
    newTitle: string;
    existingDesc: string;
    newDesc: string;
    credentialsTitle: string;
    saveSecurely: string;
    usernameLabel: string;
    passwordLabel: string;
    copy: string;
    copied: string;
    importantNotice: string;
    openAccount: string;
    registerAnother: string;
  };
  footer: string;
}

export const TRANSLATIONS: Record<StudentRegisterLang, StudentRegisterTranslations> = {
  en: {
    nav: {
      portalBadge: 'Student Portal',
      subtitle: 'Advanced Level Physics Academy Registration',
      studentLogin: 'Student Login',
      toggleThemeLight: 'Switch to Light mode',
      toggleThemeDark: 'Switch to Dark mode',
      language: 'Language',
    },
    form: {
      title: 'Create Your Student Account',
      subtitle: 'Enter your details below to generate your unique PCA ID.',
      firstName: 'Student First Name',
      firstNamePlaceholder: 'e.g. Sudarini',
      lastName: "Last Name (Father's Name)",
      lastNamePlaceholder: 'e.g. Perera',
      batch: 'Batch',
      repeatDetails: 'Repeat Student Details',
      properBatch: 'First Exam Year (Proper Batch)',
      properBatchPlaceholder: 'e.g. 2025',
      joinedBatch: 'Exam Appearing Year (Joined Batch)',
      stream: 'Stream',
      streamBio: 'Biological Science (Bio)',
      streamMaths: 'Physical Science (Maths)',
      streamOther: 'Non Stream / Other',
      school: 'School Name',
      schoolPlaceholder: 'e.g. Royal College / Ananda College / Jaffna Hindu College',
      fatherJob: "Father's Occupation",
      fatherJobPlaceholder: 'e.g. Teacher, Engineer, Businessman',
      motherJob: "Mother's Occupation",
      motherJobPlaceholder: 'e.g. Doctor, Accountant, Homemaker',
      nic: 'National Identity Card (NIC)',
      nicPlaceholder: 'e.g. 200512345678 or 981234567V',
      gender: 'Gender',
      genderSelect: 'Select Gender',
      genderMale: 'Male',
      genderFemale: 'Female',
      genderOther: 'Other',
      dob: 'Date of Birth (DOB)',
      phone: 'Phone Number',
      phonePlaceholder: '7X XXX XXXX',
      email: 'Email Address',
      emailPlaceholder: 'username',
      address1: 'Address Line 1',
      address1Placeholder: 'e.g. No. 123, Temple Road',
      address2: 'Address Line 2 (City / Area)',
      address2Placeholder: 'e.g. Nallur, Jaffna',
      district: 'District',
      footerNote: 'Your PCA ID will be generated immediately once you submit your details.',
      submit: 'Submit & Register',
      submitting: 'Generating PCA ID...',
    },
    errors: {
      phoneInvalid: 'Invalid Phone Number (Must be 9 digits)',
      emailInvalid: 'Email must end with @gmail.com or @icloud.com',
      nicInvalid: 'NIC must be 12 digits or 10 characters ending with V or X',
      genderRequired: 'Please select a gender',
      properBatchRequired: 'Please enter your first exam year',
      requiredFields: 'Please fill in all required fields marked with *',
      duplicateStudent: 'Student with this name and phone already exists',
      duplicatePhone: 'Phone number already registered',
      genericError: 'Registration failed. Please try again.',
    },
    success: {
      alreadyRegistered: 'Already Registered',
      newRegistration: 'New Registration',
      existingTitle: 'Your PCA ID Details',
      newTitle: 'Registration Completed Successfully!',
      existingDesc: 'a PCA ID is already assigned to this phone number. You can use it to sign in.',
      newDesc: 'Welcome to Physics Cube Academy, {name}. Your official PCA ID and student credentials have been generated.',
      credentialsTitle: 'Your Student Credentials',
      saveSecurely: 'Save this securely',
      usernameLabel: 'Username (PCA ID)',
      passwordLabel: 'Initial Password',
      copy: 'Copy',
      copied: 'Copied',
      importantNotice: 'Important: Your default password is the same as your PCA ID. You can use these credentials to sign in to this Student Portal and the PCA Mobile App.',
      openAccount: 'Open Student Account',
      registerAnother: 'Register Another Student',
    },
    footer: 'Physics Cube Academy • Student Registration Portal',
  },

  ta: {
    nav: {
      portalBadge: 'Student Portal',
      subtitle: 'Advanced Level Physics Academy Registration',
      studentLogin: 'மாணவர் உள்நுழைவு',
      toggleThemeLight: 'வெளிச்ச பயன்முறைக்கு மாறுக',
      toggleThemeDark: 'இருண்ட பயன்முறைக்கு மாறுக',
      language: 'மொழி',
    },
    form: {
      title: 'உங்கள் மாணவர் கணக்கை உருவாக்கவும்',
      subtitle: 'உங்கள் விபரங்களை உள்ளிட்டு உங்களுக்கான பிரத்தியேக PCA ID ஐ பெற்றுக்கொள்ளுங்கள்.',
      firstName: 'மாணவரின் பெயர் (First Name)',
      firstNamePlaceholder: 'உ-ம்: சுதர்சினி',
      lastName: 'தந்தையின் பெயர் (Last Name)',
      lastNamePlaceholder: 'உ-ம்: பெரேரா',
      batch: 'தொகுதி (Batch)',
      repeatDetails: 'மீண்டும் தோற்றும் மாணவர் விபரம்',
      properBatch: 'முதல் தடவை பரீட்சைக்கு தோற்றிய ஆண்டு (Proper Batch)',
      properBatchPlaceholder: 'உ-ம்: 2025',
      joinedBatch: 'பரீட்சைக்கு தோற்றவுள்ள ஆண்டு (Joined Batch)',
      stream: 'பிரிவு (Stream)',
      streamBio: 'உயிரியல் விஞ்ஞானம் (Bio)',
      streamMaths: 'பௌதிக விஞ்ஞானம் (Maths)',
      streamOther: 'ஏனையவை (Non Stream)',
      school: 'பாடசாலையின் பெயர்',
      schoolPlaceholder: 'உ-ம்: யாழ் இந்துக் கல்லூரி / றோயல் கல்லூரி / ஆனந்தா கல்லூரி',
      fatherJob: 'தந்தையின் தொழில்',
      fatherJobPlaceholder: 'உ-ம்: ஆசிரியர், பொறியியலாளர், வியாபாரி',
      motherJob: 'தாயின் தொழில்',
      motherJobPlaceholder: 'உ-ம்: மருத்துவர், கணக்காளர், குடும்பத்தலைவி',
      nic: 'அடையாள அட்டை இலக்கம் (NIC)',
      nicPlaceholder: 'உ-ம்: 200512345678 அல்லது 981234567V',
      gender: 'பால் (Gender)',
      genderSelect: 'பாலை தெரிவு செய்யவும்',
      genderMale: 'ஆண்',
      genderFemale: 'பெண்',
      genderOther: 'ஏனையவை',
      dob: 'பிறந்த திகதி (DOB)',
      phone: 'தொலைபேசி இலக்கம்',
      phonePlaceholder: '7X XXX XXXX',
      email: 'மின்னஞ்சல் முகவரி',
      emailPlaceholder: 'username',
      address1: 'முகவரி 1 (வீட்டு இலக்கம் / வீதி)',
      address1Placeholder: 'உ-ம்: இல. 123, கோயில் வீதி',
      address2: 'முகவரி 2 (நகரம் / பிரதேசம்)',
      address2Placeholder: 'உ-ம்: நல்லூர், யாழ்ப்பாணம்',
      district: 'மாவட்டம் (District)',
      footerNote: 'விபரங்களை சமர்ப்பித்தவுடன் உங்களுக்கான PCA ID உடனடியாக உருவாக்கப்படும்.',
      submit: 'சமர்ப்பிக்கவும்',
      submitting: 'PCA ID உருவாக்கப்படுகிறது...',
    },
    errors: {
      phoneInvalid: 'செல்லுபடியற்ற தொலைபேசி இலக்கம் (9 இலக்கங்கள் இருக்க வேண்டும்)',
      emailInvalid: 'மின்னஞ்சல் @gmail.com அல்லது @icloud.com இல் முடிய வேண்டும்',
      nicInvalid: 'அடையாள அட்டை 12 இலக்கங்கள் அல்லது V/X இல் முடியும் 10 எழுத்துக்களாக இருக்க வேண்டும்',
      genderRequired: 'தயவுசெய்து பாலை தெரிவு செய்யவும்',
      properBatchRequired: 'முதல் தடவை பரீட்சைக்கு தோற்றிய ஆண்டை உள்ளிடவும்',
      requiredFields: '* குறியிடப்பட்ட அனைத்து கட்டாய விபரங்களையும் நிரப்பவும்',
      duplicateStudent: 'இந்த பெயரிலும் தொலைபேசி இலக்கத்திலும் மாணவர் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளார்',
      duplicatePhone: 'இந்த தொலைபேசி இலக்கம் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது',
      genericError: 'பதிவு தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.',
    },
    success: {
      alreadyRegistered: 'ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது',
      newRegistration: 'புதிய பதிவு',
      existingTitle: 'உங்கள் PCA ID விபரம்',
      newTitle: 'பதிவு வெற்றிகரமாக முடிவடைந்தது!',
      existingDesc: 'இந்த தொலைபேசி இலக்கத்திற்கு ஏற்கனவே PCA ID ஒதுக்கப்பட்டுள்ளது. நீங்கள் இதை பயன்படுத்தி உள்நுழையலாம்.',
      newDesc: 'Physics Cube Academy இற்கு உங்களை அன்புடன் வரவேற்கிறோம், {name}. உங்களுக்கான உத்தியோகபூர்வ PCA ID உருவாக்கப்பட்டுள்ளது.',
      credentialsTitle: 'உங்கள் மாணவர் உள்நுழைவு விபரம்',
      saveSecurely: 'இதை பாதுகாப்பாக வைத்திருக்கவும்',
      usernameLabel: 'பயனர் பெயர் (PCA ID)',
      passwordLabel: 'ஆரம்ப கடவுச்சொல்',
      copy: 'பிரதியெடு',
      copied: 'பிரதியெடுக்கப்பட்டது',
      importantNotice: 'முக்கிய குறிப்பு: உங்கள் ஆரம்ப கடவுச்சொல் உங்களின் PCA ID ஆகும். இதனை பயன்படுத்தி நீங்கள் மாணவர் போர்டல் மற்றும் PCA Mobile App இல் உள்நுழையலாம்.',
      openAccount: 'மாணவர் கணக்கை திறக்கவும்',
      registerAnother: 'மற்றொரு மாணவரை பதிவு செய்க',
    },
    footer: 'Physics Cube Academy • மாணவர் பதிவு போர்டல்',
  },

  si: {
    nav: {
      portalBadge: 'Student Portal',
      subtitle: 'Advanced Level Physics Academy Registration',
      studentLogin: 'ශිෂ්‍ය පිවිසුම',
      toggleThemeLight: 'ආලෝක මාදිලියට මාරු වන්න',
      toggleThemeDark: 'අඳුරු මාදිලියට මාරු වන්න',
      language: 'භාෂාව',
    },
    form: {
      title: 'ඔබගේ ශිෂ්‍ය ගිණුම සාදාගන්න',
      subtitle: 'ඔබගේ අනන්‍ය PCA ID කේතය ලබාගැනීමට පහත තොරතුරු ඇතුළත් කරන්න.',
      firstName: 'ශිෂ්‍යයාගේ නම / මුල් නම (First Name)',
      firstNamePlaceholder: 'උදා: නිමාෂා',
      lastName: 'වාසගම / පියාගේ නම (Last Name)',
      lastNamePlaceholder: 'උදා: පෙරේරා',
      batch: 'කණ්ඩායම (Batch)',
      repeatDetails: 'නැවත පෙනී සිටින ශිෂ්‍ය තොරතුරු',
      properBatch: 'පළමු වර විභාගයට පෙනී සිටි වසර (Proper Batch)',
      properBatchPlaceholder: 'උදා: 2025',
      joinedBatch: 'විභාගයට පෙනී සිටින වසර (Joined Batch)',
      stream: 'විෂය ධාරාව (Stream)',
      streamBio: 'ජීව විද්‍යා අංශය (Bio)',
      streamMaths: 'භෞතික විද්‍යා / ගණිත අංශය (Maths)',
      streamOther: 'වෙනත් (Non Stream)',
      school: 'පාසලේ නම',
      schoolPlaceholder: 'උදා: ආනන්ද විද්‍යාලය / රාජකීය විද්‍යාලය / යාපනය හින්දු විද්‍යාලය',
      fatherJob: 'පියාගේ රැකියාව',
      fatherJobPlaceholder: 'උදා: ගුරුවරයෙක්, ඉංජිනේරුවෙක්, ව්‍යාපාරිකයෙක්',
      motherJob: 'මවගේ රැකියාව',
      motherJobPlaceholder: 'උදා: වෛද්‍යවරියක්, ගණකාධිකාරිනියක්, ගෘහණියක්',
      nic: 'ජාතික හැඳුනුම්පත් අංකය (NIC)',
      nicPlaceholder: 'උදා: 200512345678 හෝ 981234567V',
      gender: 'ස්ත්‍රී / පුරුෂ භාවය (Gender)',
      genderSelect: 'තෝරන්න',
      genderMale: 'පුරුෂ',
      genderFemale: 'ස්ත්‍රී',
      genderOther: 'වෙනත්',
      dob: 'උපන් දිනය (DOB)',
      phone: 'දුරකථන අංකය',
      phonePlaceholder: '7X XXX XXXX',
      email: 'විද්‍යුත් තැපැල් ලිපිනය',
      emailPlaceholder: 'username',
      address1: 'ලිපිනය පේළිය 1 (නිවාස අංකය / වීදිය)',
      address1Placeholder: 'උදා: අංක 123, පන්සල පාර',
      address2: 'ලිපිනය පේළිය 2 (නගරය / ප්‍රදේශය)',
      address2Placeholder: 'උදා: නල්ලූර්, යාපනය',
      district: 'දිස්ත්‍රික්කය (District)',
      footerNote: 'තොරතුරු ඉදිරිපත් කළ වහාම ඔබගේ PCA ID කේතය ක්ෂණිකව නිර්මාණය වේ.',
      submit: 'ලියාපදිංචි වන්න',
      submitting: 'PCA ID නිර්මාණය වෙමින් පවතී...',
    },
    errors: {
      phoneInvalid: 'වලංගු නොවන දුරකථන අංකයකි (ඉලක්කම් 9ක් විය යුතුය)',
      emailInvalid: 'විද්‍යුත් තැපෑල @gmail.com හෝ @icloud.com විය යුතුය',
      nicInvalid: 'හැඳුනුම්පත ඉලක්කම් 12ක් හෝ V/X සහිත අක්ෂර 10ක් විය යුතුය',
      genderRequired: 'කරුණාකර ස්ත්‍රී/පුරුෂ භාවය තෝරන්න',
      properBatchRequired: 'කරුණාකර පළමු වර විභාගයට පෙනී සිටි වසර ඇතුළත් කරන්න',
      requiredFields: '* ලකුණු කර ඇති සියලුම අනිවාර්ය තොරතුරු පුරවන්න',
      duplicateStudent: 'මෙම නමින් සහ දුරකථන අංකයෙන් ශිෂ්‍යයෙකු දැනටමත් ලියාපදිංචි වී ඇත',
      duplicatePhone: 'මෙම දුරකථන අංකය දැනටමත් ලියාපදිංචි වී ඇත',
      genericError: 'ලියාපදිංචිය අසාර්ථක විය. කරුණාකර නැවත උත්සාහ කරන්න.',
    },
    success: {
      alreadyRegistered: 'දැනටමත් ලියාපදිංචි වී ඇත',
      newRegistration: 'නව ලියාපදිංචිය',
      existingTitle: 'ඔබගේ PCA ID තොරතුරු',
      newTitle: 'ලියාපදිංචිය සාර්ථකයි!',
      existingDesc: 'මෙම දුරකථන අංකයට දැනටමත් PCA ID එකක් නිකුත් කර ඇත. ඔබට එය භාවිතයෙන් ඇතුළු විය හැක.',
      newDesc: 'Physics Cube Academy වෙත ඔබව සාදරයෙන් පිළිගනිමු, {name}. ඔබගේ නිල PCA ID සහ ශිෂ්‍ය තොරතුරු නිර්මාණය කර ඇත.',
      credentialsTitle: 'ඔබගේ ශිෂ්‍ය පිවිසුම් තොරතුරු',
      saveSecurely: 'මෙය සුරක්ෂිතව තබා ගන්න',
      usernameLabel: 'පරිශීලක නාමය (PCA ID)',
      passwordLabel: 'මුරපදය',
      copy: 'පිටපත් කරන්න',
      copied: 'පිටපත් විය',
      importantNotice: 'වැදගත්: ඔබගේ මුරපදය ඔබගේ PCA ID එකම වේ. ඔබට මෙම විස්තර භාවිතයෙන් ශිෂ්‍ය පෝටලයට සහ PCA Mobile App වෙත පිවිසිය හැක.',
      openAccount: 'ශිෂ්‍ය ගිණුමට පිවිසෙන්න',
      registerAnother: 'වෙනත් ශිෂ්‍යයෙකු ලියාපදිංචි කරන්න',
    },
    footer: 'Physics Cube Academy • ශිෂ්‍ය ලියාපදිංචි පෝටලය',
  },
};
