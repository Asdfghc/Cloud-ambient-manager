Vagrant.configure("2") do |config|
  config.vm.boot_timeout = 600

  config.vm.define "cloud-ambient-manager" do |client|
    client.vm.box = "bento/ubuntu-24.04"
    client.vm.hostname = "cloud-ambient-manager"

    # FastAPI (uvicorn) -> http://localhost:8000
    client.vm.network "forwarded_port", guest: 8000, host: 8000, host_ip: "0.0.0.0"

    client.vm.provider "virtualbox" do |vb|
      #vb.customize ["modifyvm", :id, "--appendconfig", "nopti nospectre_v2 nospectre_v1 irqpoll"]
			#vb.customize ["storagectl", :id, "--name", "SATA Controller", "--hostiocache", "on"]
      vb.customize ["modifyvm", :id, "--ioapic", "on"]
      vb.customize ["modifyvm", :id, "--paravirt-provider", "hyperv"]
      vb.gui = false
      vb.memory = "4096"
      vb.cpus = 1
      vb.name = "cloud-ambient-manager"
    end

    client.vm.provision "shell", inline: <<-SHELL
      set -e
      export DEBIAN_FRONTEND=noninteractive

      apt-get update
      apt-get install -y git python3 python3-fastapi python3-multipart python3-mysqldb uvicorn mysql-server

      # Clone do repositório
      rm -rf /opt/Cloud-ambient-manager
      git clone https://github.com/Asdfghc/Cloud-ambient-manager.git /opt/Cloud-ambient-manager

      # Database
      systemctl enable --now mysql
      INIT_SQL=$(find /opt/Cloud-ambient-manager -name init.sql | head -n 1)
      if [ -n "$INIT_SQL" ]; then
        mysql < "$INIT_SQL"
        echo "Database loaded from $INIT_SQL"
      else
        echo "init.sql not found"
      fi

      # Backend (service de systemd)
      cat > /etc/systemd/system/backend.service <<'EOF'
[Unit]
Description=Cloud Ambient Manager backend
After=network.target mysql.service
Requires=mysql.service

[Service]
WorkingDirectory=/opt/Cloud-ambient-manager/backend
ExecStart=/usr/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
      systemctl daemon-reload
      systemctl enable backend
      systemctl restart backend
    SHELL
  end
end
