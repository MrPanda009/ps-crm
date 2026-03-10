import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// We need service_role key to bypass RLS for this test script
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const args = process.argv.slice(2);
  const action = args[0]; // "create" | "update"
  const workerId = args[1];

  if (!action || !workerId) {
    console.error("Usage: npx ts-node verify_sync.ts <create|update> <worker_id> [ticket_id]");
    process.exit(1);
  }

  if (action === 'create') {
    // Generate semi-random string for ticket ID
    const randomTicket = `TEST-${Math.floor(Math.random() * 10000)}`;
    const { data, error } = await supabase.from('complaints').insert({
      ticket_id: randomTicket,
      title: `Live Sync Test ${randomTicket}`,
      description: 'Testing if realtime UI updates.',
      severity: 'L1',
      status: 'assigned',
      assigned_worker_id: workerId,
      assigned_department: 'TestDept',
      address_text: '123 Sync Lane, React City',
      location: 'POINT(77.2090 28.6139)' // Dummy Delhi location
    }).select('id');

    if (error) {
      console.error("Failed to insert dummy ticket:", error);
    } else {
      console.log(`Successfully created and assigned dummy ticket! DB ID: ${data[0].id}`);
    }
  } 
  else if (action === 'update') {
    const complaintId = args[2];
    if (!complaintId) {
       console.error("Usage: npx ts-node verify_sync.ts update <worker_id> <complaint_id>");
       process.exit(1);
    }

    const { error } = await supabase.from('complaints').update({
       status: 'in_progress',
       title: 'Live Sync Test (UPDATED!)'
    }).eq('id', complaintId);

    if (error) {
      console.error("Failed to update ticket:", error);
    } else {
      console.log(`Successfully updated the dummy ticket to 'in_progress'.`);
    }
  }
}

run();
