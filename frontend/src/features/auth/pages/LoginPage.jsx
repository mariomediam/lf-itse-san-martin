import LoginForm from '@features/auth/components/LoginForm';

const LoginPage = () => {
  return (
    <div className="min-h-screen bg-neutral flex items-center justify-center p-4">
      <div className="w-full max-w-4xl flex rounded-2xl shadow-2xl overflow-hidden">

        {/* Panel izquierdo — formulario */}
        <div className="w-full md:w-1/2 bg-white flex flex-col items-center justify-center px-10 py-12">
          <img
            src="/images/escudo-muni.png"
            alt="Escudo Municipalidad"
            className="h-20 w-auto mb-3"
          />
          <p className="text-primary text-sm font-semibold text-center mb-6">
            Municipalidad Provincial de San Martín
          </p>

          <div className="w-full mb-8">
            <h1 className="text-primary text-2xl font-bold leading-tight mb-1">
              Sistema de Gestión de Licencias de funcionamiento e ITSE
            </h1>
            <p className="text-secondary text-sm">Acceso para personal autorizado</p>
          </div>

          <LoginForm />
        </div>

        {/* Panel derecho — imagen */}
        <div className="hidden md:block md:w-1/2 bg-primary relative overflow-hidden">
          <img
            src="/images/img-login.png"
            alt="Sistema LF ITSE"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary/90 to-transparent px-8 py-6">
            <p className="text-white text-sm font-medium text-center leading-relaxed">
              Simplificando los procesos administrativos para una gestión pública moderna, transparente y eficiente
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
