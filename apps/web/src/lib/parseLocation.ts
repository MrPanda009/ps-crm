export interface ParsedLocation {
  address_text: string
  pincode: string | null
  ward_name: string | null
  lat: number
  lng: number
  accuracy_m: number | null
}

export function parseLocationData(
  rawString: string,
  lat: number,
  lng: number
): ParsedLocation {
  // Extract clean address — everything before the first pipe |
  const address = rawString.split('|')[0].trim()

  // Extract 6-digit Indian pincode
  const pincodeMatch = address.match(/\b\d{6}\b/)
  const pincode = pincodeMatch ? pincodeMatch[0] : null

  // Extract GPS accuracy if present
  const accuracyMatch = rawString.match(/gps_accuracy_m=([\d.]+)/)
  const accuracy = accuracyMatch ? parseFloat(accuracyMatch[1]) : null

  // Extract ward/tehsil — second comma-separated segment
  const addressParts = address.split(',').map(p => p.trim())
  const ward_name = addressParts.length > 1 ? addressParts[1] : null

  // Handle case where raw string contains "Lat X, Lng Y" format
  let finalLat = lat
  let finalLng = lng
  const latMatch = rawString.match(/Lat\s+([\d.]+)/)
  const lngMatch = rawString.match(/Lng\s+([\d.]+)/)
  if (latMatch && lngMatch) {
    finalLat = parseFloat(latMatch[1])
    finalLng = parseFloat(lngMatch[1])
  }

  return {
    address_text: address,
    pincode,
    ward_name,
    lat: finalLat,
    lng: finalLng,
    accuracy_m: accuracy
  }
}
