export type UserRole = 'FARMER' | 'EQUIPMENT_OWNER' | 'OPERATOR';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';
export type EquipmentAvailability = 'AVAILABLE' | 'LIMITED' | 'BOOKED';
export type EquipmentCategory =
  | 'TRACTORS'
  | 'PLANTERS'
  | 'AGRICULTURAL_DRONES'
  | 'COLD_STORAGE'
  | 'TRANSPORT_VEHICLES'
  | 'HARVESTING_EQUIPMENT'
  | 'OTHER_MACHINERY';

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type Equipment = {
  id: string;
  name: string;
  category: EquipmentCategory;
  description: string;
  pricePerDay: number | string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  images?: EquipmentImage[];
  specifications: string[];
  availability: EquipmentAvailability;
  owner: Pick<User, 'id' | 'name'>;
};

export type EquipmentImage = {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type NearbyEquipment = Equipment & {
  distanceKm: number;
};

export type EquipmentInput = {
  name: string;
  category: EquipmentCategory;
  description: string;
  pricePerDay: number;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  imageUrls?: string[];
  imageUrl?: string;
  specifications: string[];
  availability?: EquipmentAvailability;
};

export type Booking = {
  id: string;
  farmer: Pick<User, 'id' | 'name'>;
  owner: Pick<User, 'id' | 'name'>;
  equipment: Pick<Equipment, 'id' | 'name' | 'imageUrl'>;
  requestedDate: string;
  notes: string;
  status: BookingStatus;
};

export type AvailabilityWindow = {
  date: string;
  isAvailable: boolean;
  note: string | null;
};

export type EquipmentAvailabilityCalendar = {
  windows: AvailabilityWindow[];
  bookedDates: string[];
};

export type OperatorProfile = {
  bio: string | null;
  experienceYears: number;
  certificationStatus: 'PENDING' | 'CERTIFIED' | 'REJECTED';
  certifiedAt: string | null;
  documents: {
    id: string;
    type: 'IDENTITY' | 'LICENSE' | 'CERTIFICATE' | 'OTHER';
    originalName: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    reviewNotes: string | null;
  }[];
};

export type OperatorDocumentType = 'IDENTITY' | 'LICENSE' | 'CERTIFICATE' | 'OTHER';
export type OperatorDocumentInput = {
  uri: string;
  fileName: string;
  mimeType: string;
  type: OperatorDocumentType;
  file?: Blob;
};

export type NotificationItem = {
  id: string;
  type: 'BOOKING_REQUEST' | 'BOOKING_STATUS' | 'CERTIFICATION_UPDATE' | 'SYSTEM';
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  bookingId: string | null;
};

export type NotificationInbox = {
  notifications: NotificationItem[];
  unreadCount: number;
};

export type PublicOwnerProfile = {
  id: string;
  name: string;
  equipment: Pick<
    Equipment,
    'id' | 'name' | 'category' | 'location' | 'pricePerDay' | 'imageUrl' | 'availability'
  >[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      `Could not connect to AgriShare API at ${apiBaseUrl}. Check that the backend is running and the API URL is correct.`,
      0,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  const payload: unknown = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}) {
  return request<{ user: User; token: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function login(input: { email: string; password: string }) {
  return request<{ user: User; token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getCurrentUser() {
  return request<User>('/api/auth/me');
}

export async function getEquipment(filters: {
  search?: string;
  category?: EquipmentCategory;
  available?: boolean;
} = {}) {
  const query = new URLSearchParams();
  if (filters.search?.trim()) query.set('search', filters.search.trim());
  if (filters.category) query.set('category', filters.category);
  if (filters.available) query.set('available', 'true');
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return request<Equipment[]>(`/api/equipment${suffix}`);
}

export async function searchNearbyEquipment(filters: {
  latitude: number;
  longitude: number;
  radiusKm: number;
  category?: EquipmentCategory;
  search?: string;
}) {
  const query = new URLSearchParams({
    latitude: String(filters.latitude),
    longitude: String(filters.longitude),
    radiusKm: String(filters.radiusKm),
  });
  if (filters.category) query.set('category', filters.category);
  if (filters.search?.trim()) query.set('search', filters.search.trim());
  return request<NearbyEquipment[]>(`/api/equipment/search?${query.toString()}`);
}

export async function getEquipmentById(id: string) {
  return request<Equipment>(`/api/equipment/${encodeURIComponent(id)}`);
}

export async function getEquipmentAvailability(id: string, month: string) {
  const query = new URLSearchParams({ month });
  return request<EquipmentAvailabilityCalendar>(
    `/api/equipment/${encodeURIComponent(id)}/availability?${query.toString()}`,
  );
}

export async function setEquipmentAvailability(
  id: string,
  dates: string[],
  isAvailable: boolean,
) {
  return request<AvailabilityWindow[]>(`/api/equipment/${encodeURIComponent(id)}/availability`, {
    method: 'POST',
    body: JSON.stringify({ dates, isAvailable }),
  });
}

export async function getOwnerEquipment() {
  return request<Equipment[]>('/api/equipment/mine');
}

export async function getOwnerProfile(id: string) {
  return request<PublicOwnerProfile>(`/api/owners/${encodeURIComponent(id)}`);
}

export async function createEquipment(input: EquipmentInput): Promise<Equipment> {
  return request<Equipment>('/api/equipment', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateEquipment(id: string, input: Partial<EquipmentInput>) {
  return request<Equipment>(`/api/equipment/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteEquipment(id: string) {
  return request<void>(`/api/equipment/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

type CloudinarySignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
};

export async function uploadEquipmentImage(
  uri: string,
  fileName: string,
  mimeType: string,
  pickedFile?: Blob,
) {
  const signed = await request<CloudinarySignature>('/api/cloudinary/signature', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  let image = pickedFile;
  if (!image) {
    const fileResponse = await fetch(uri);
    if (!fileResponse.ok) throw new ApiError('Could not read the selected image.', fileResponse.status);
    image = await fileResponse.blob();
  }
  if (!image.type) image = image.slice(0, image.size, mimeType);
  const form = new FormData();
  form.append('file', image, fileName);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('folder', signed.folder);
  form.append('signature', signed.signature);

  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`, {
      method: 'POST',
      body: form,
    });
  } catch {
    throw new ApiError('Could not connect to Cloudinary. Check your network and try again.', 0);
  }
  const payload: unknown = await response.json();
  if (
    !response.ok ||
    typeof payload !== 'object' ||
    payload === null ||
    !('secure_url' in payload) ||
    typeof payload.secure_url !== 'string'
  ) {
    const cloudinaryMessage =
      typeof payload === 'object' && payload !== null &&
      'error' in payload && typeof payload.error === 'object' && payload.error !== null &&
      'message' in payload.error && typeof payload.error.message === 'string'
        ? payload.error.message
        : null;
    const message = cloudinaryMessage && /cloud_name mismatch|invalid cloud_name/i.test(cloudinaryMessage)
      ? `Cloudinary rejected the configured cloud "${signed.cloudName}". Keep this Cloud Name and use the API key and secret from that same Cloudinary product environment.`
      : cloudinaryMessage ?? 'Cloudinary could not upload the selected image.';
    throw new ApiError(message, response.status);
  }
  return payload.secure_url;
}

export async function createBooking(input: {
  equipmentId: string;
  requestedDate: string;
  notes: string;
}) {
  return request<Booking>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getBookings() {
  return request<Booking[]>('/api/bookings');
}

export async function getMyBookings() {
  return request<Booking[]>('/api/bookings/my-bookings');
}

export async function getOwnerBookingRequests() {
  return request<Booking[]>('/api/bookings/owner-requests');
}

export async function getOperatorProfile() {
  return request<OperatorProfile>('/api/operators/profile');
}

export async function saveOperatorProfile(input: {
  bio: string;
  experienceYears: number;
  documents: { publicId: string; originalName: string; type: OperatorDocumentType }[];
}) {
  return request<OperatorProfile>('/api/operators/profile', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getNotifications() {
  return request<NotificationInbox>('/api/notifications');
}

export async function markNotificationRead(id: string) {
  return request<{ notification: NotificationItem; unreadCount: number }>(
    `/api/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' },
  );
}

type OperatorDocumentSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  type: 'authenticated';
  allowedFormats: string;
  resourceType: 'raw';
  signature: string;
};

export async function uploadOperatorDocument(document: OperatorDocumentInput) {
  const signed = await request<OperatorDocumentSignature>('/api/cloudinary/operator-document-signature', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  let file = document.file;
  if (!file) {
    const fileResponse = await fetch(document.uri);
    if (!fileResponse.ok) throw new ApiError('Could not read the selected document.', fileResponse.status);
    file = await fileResponse.blob();
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new ApiError('Each certification document must be 10 MB or smaller.', 400);
  }
  if (!file.type) file = file.slice(0, file.size, document.mimeType);
  const form = new FormData();
  form.append('file', file, document.fileName);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('folder', signed.folder);
  form.append('type', signed.type);
  form.append('allowed_formats', signed.allowedFormats);
  form.append('signature', signed.signature);

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/${signed.resourceType}/upload`,
      { method: 'POST', body: form },
    );
  } catch {
    throw new ApiError('Could not connect to Cloudinary. Check your network and try again.', 0);
  }
  const payload: unknown = await response.json();
  if (
    !response.ok ||
    typeof payload !== 'object' ||
    payload === null ||
    !('public_id' in payload) ||
    typeof payload.public_id !== 'string' ||
    !payload.public_id.startsWith(`${signed.folder}/`) ||
    !('type' in payload) ||
    payload.type !== 'authenticated' ||
    !('resource_type' in payload) ||
    payload.resource_type !== 'raw'
  ) {
    const message =
      typeof payload === 'object' && payload !== null &&
      'error' in payload && typeof payload.error === 'object' && payload.error !== null &&
      'message' in payload.error && typeof payload.error.message === 'string'
        ? payload.error.message
        : 'Cloudinary could not securely upload the selected document.';
    throw new ApiError(message, response.status);
  }
  return payload.public_id;
}

export async function getOperatorDocumentDownloadUrl(id: string) {
  return request<{ url: string; expiresAt: number }>(
    `/api/operators/profile/documents/${encodeURIComponent(id)}/download`,
  );
}

export async function updateBookingStatus(id: string, status: 'CONFIRMED' | 'REJECTED') {
  const action = status === 'CONFIRMED' ? 'approve' : 'reject';
  return request<Booking>(`/api/bookings/${encodeURIComponent(id)}/${action}`, { method: 'PATCH' });
}

export async function cancelBooking(id: string) {
  return request<Booking>(`/api/bookings/${encodeURIComponent(id)}/cancel`, {
    method: 'PATCH',
  });
}

export function getApiErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
